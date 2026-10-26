import { ZodError } from "zod";
import sharp from "sharp";
import { DomainError, decisionSchema } from "../packages/core";
import { createHandoff, exportMarkdown } from "../packages/exporters";
import { presets } from "../packages/presets";
import type { Store } from "../packages/persistence";
import { MAX_FILE_BYTES } from "../packages/persistence/storage";

export const COOKIE_NAME = "designref_session";
const noStore = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
function json(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(value, { status, headers: { ...noStore, ...headers } });
}
function cookie(token: string, secure: boolean, clear = false) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}${clear ? "; Max-Age=0" : ""}`;
}
async function limitedBody(request: Request, max: number) {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > max)) throw new DomainError(413, "O conteúdo enviado ultrapassa o limite permitido.");
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) { await reader.cancel(); throw new DomainError(413, "O conteúdo enviado ultrapassa o limite permitido."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
async function bodyJson(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new DomainError(415, "Envie conteúdo JSON.");
  const bytes = await limitedBody(request, 128 * 1024);
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new DomainError(400, "JSON inválido. Revise os dados enviados."); }
}
export function createApi(store: Store, origin: string) {
  const configuredOrigin = new URL(origin).origin, secure = configuredOrigin.startsWith("https:");
  return async (request: Request, path: string[]): Promise<Response> => {
    try {
      const method = request.method, route = path.join("/");
      const write = !["GET", "HEAD", "OPTIONS"].includes(method);
      if (write && (request.headers.get("origin") !== configuredOrigin || request.headers.get("sec-fetch-site") === "cross-site")) throw new DomainError(403, "Origem da solicitação não autorizada.", "origin_denied");
      const token = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
      if (route === "session" && method === "POST") {
        await bodyJson(request); // Enforce size and media type even on an empty creation payload.
        const existing = store.resolveSession(token);
        if (existing) return json(store.workspace(existing));
        const created = store.createSession();
        return json(store.workspace(created.session), 201, { "Set-Cookie": cookie(created.token, secure) });
      }
      if (route === "presets" && method === "GET") return json(presets);
      const session = store.resolveSession(token);
      if (!session) throw new DomainError(401, "Sua sessão expirou ou foi encerrada. Comece uma nova sessão.", "session_expired");
      if (write) store.rateLimit(`write:${session.id}`, 120, 60000);
      if (route === "session" && method === "GET") return json(store.sessionInfo(session));
      if (route === "session" && method === "DELETE") {
        await limitedBody(request, 1024);
        const result = store.endSession(session);
        return json(result, 200, { "Set-Cookie": cookie("", secure, true) });
      }
      if (route === "project" && method === "GET") return json(store.workspace(session));
      if (route === "project" && method === "PATCH") return json(store.rename(session, await bodyJson(request)));
      if (route === "references" && method === "GET") {
        const params = new URL(request.url).searchParams;
        return json(store.references(session, Object.fromEntries(["q", "kind", "industry", "tag", "priority"].map(key => [key, params.get(key) || ""]))));
      }
      if (route === "references" && method === "POST") return json(store.createReference(session, await bodyJson(request)), 201);
      if (route === "references/upload" && method === "POST") {
        if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) throw new DomainError(415, "Envie a imagem pelo formulário de upload.");
        const bytes = await limitedBody(request, MAX_FILE_BYTES + 128 * 1024);
        let form: FormData;
        try { form = await new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData(); }
        catch { throw new DomainError(400, "Formulário de upload inválido."); }
        const file = form.get("file"), metadata = form.get("metadata");
        if (!(file instanceof File) || typeof metadata !== "string") throw new DomainError(422, "Selecione uma imagem e preencha seus dados.");
        if (file.size > MAX_FILE_BYTES) throw new DomainError(413, "A imagem deve ter até 10 MB.");
        let input: unknown;
        try { input = JSON.parse(metadata); } catch { throw new DomainError(400, "Metadados de imagem inválidos."); }
        const data = new Uint8Array(await file.arrayBuffer());
        // Decode metadata, with a pixel limit, to reject malformed images and decompression bombs.
        try {
          const details = await sharp(data, { limitInputPixels: 40000000, failOn: "warning" }).metadata();
          if (!["png", "jpeg", "webp"].includes(details.format || "") || (details.pages ?? 1) > 1) throw new Error("unsupported image");
          await sharp(data, { limitInputPixels: 40000000, failOn: "warning" }).resize(1, 1).raw().toBuffer();
        } catch { throw new DomainError(415, "Imagem inválida ou muito complexa. Use PNG, JPEG ou WebP estático de até 40 megapixels."); }
        return json(store.upload(session, input, data, file.type), 201);
      }
      if (path[0] === "references" && path.length === 2 && method === "GET") return json(store.reference(session, path[1]));
      if (path[0] === "references" && path.length === 2 && method === "PATCH") return json(store.updateReference(session, path[1], await bodyJson(request)));
      if (path[0] === "references" && path.length === 2 && method === "DELETE") {
        await limitedBody(request, 1024); return json(store.deleteReference(session, path[1]));
      }
      if (path[0] === "uploads" && path.length === 2 && method === "GET") {
        const image = store.readImage(session, path[1]);
        return new Response(new Uint8Array(image.bytes), { headers: { ...noStore, "Content-Type": image.mime, "Content-Disposition": "inline", "Content-Security-Policy": "default-src 'none'; sandbox" } });
      }
      if (route === "brief" && method === "GET") return json(store.brief(session));
      if (route === "brief" && method === "PUT") return json(store.saveBrief(session, await bodyJson(request)));
      if (route === "decisions" && method === "GET") return json(store.decisions(session));
      if (route === "decisions" && method === "POST") return json(store.addDecision(session, decisionSchema.parse(await bodyJson(request))), 201);
      if (path[0] === "decisions" && path.length === 2 && method === "DELETE") {
        await limitedBody(request, 1024); store.deleteDecision(session, path[1]); return json({ deleted: true });
      }
      if (route === "export" && method === "GET") {
        const params = new URL(request.url).searchParams, format = params.get("format") || "json";
        if (!["json", "md"].includes(format)) throw new DomainError(400, "Formato de exportação inválido.");
        const handoff = createHandoff(store.workspace(session), presets);
        return new Response(format === "md" ? exportMarkdown(handoff) : JSON.stringify(handoff, null, 2), { headers: {
          ...noStore, "Content-Type": format === "md" ? "text/markdown; charset=utf-8" : "application/json; charset=utf-8",
          "Content-Disposition": `${params.get("download") === "1" ? "attachment" : "inline"}; filename="designref-handoff.${format}"`
        } });
      }
      throw new DomainError(404, "Recurso não encontrado.", "not_found");
    } catch (error) {
      if (error instanceof ZodError) return json({ error: "Revise os campos informados.", code: "validation_error", issues: error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })) }, 422);
      if (error instanceof DomainError) return json({ error: error.message, code: error.code }, error.status, error.status === 401 ? { "Set-Cookie": cookie("", secure, true) } : error.status === 429 ? { "Retry-After": "60" } : {});
      console.error("DesignRef request failed:", error instanceof Error ? error.name : "unknown error");
      return json({ error: "Não foi possível concluir a ação. Tente novamente.", code: "internal_error" }, 500);
    }
  };
}
