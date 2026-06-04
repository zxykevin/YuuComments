import type { Env } from "./types";
import {
  deleteAdminComment,
  getAdminComments,
  updateAdminCommentStatus,
} from "./routes/adminComments";
import {
  getAdminReports,
  updateAdminReportStatus,
} from "./routes/adminReports";
import { createComment } from "./routes/createComment";
import { getComments } from "./routes/getComments";
import { likeComment, unlikeComment } from "./routes/commentLikes";
import { reportComment } from "./routes/reportComment";
import { getCorsHeaders, handleOptions } from "./utils/cors";
import { ValidationError } from "./utils/validate";

function jsonResponse(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: getCorsHeaders(request),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    try {
      if (url.pathname === "/api/comments") {
        if (request.method === "GET") {
          const response = await getComments(request, env);
          return withCors(request, response);
        }

        if (request.method === "POST") {
          const response = await createComment(request, env);
          return withCors(request, response);
        }

        return jsonResponse(
          request,
          {
            ok: false,
            message: "方法不允许",
          },
          405,
        );
      }

      if (url.pathname === "/api/admin/comments") {
        if (request.method === "GET") {
          const response = await getAdminComments(request, env);
          return withCors(request, response);
        }

        return jsonResponse(
          request,
          {
            ok: false,
            message: "方法不允许",
          },
          405,
        );
      }

      if (url.pathname === "/api/admin/reports") {
        if (request.method === "GET") {
          const response = await getAdminReports(request, env);
          return withCors(request, response);
        }

        return jsonResponse(
          request,
          {
            ok: false,
            message: "方法不允许",
          },
          405,
        );
      }

      const commentLikeMatch = url.pathname.match(
        /^\/api\/comments\/([^/]+)\/like$/,
      );
      if (commentLikeMatch) {
        if (request.method === "POST") {
          const response = await likeComment(request, env, commentLikeMatch[1]);
          return withCors(request, response);
        }

        if (request.method === "DELETE") {
          const response = await unlikeComment(request, env, commentLikeMatch[1]);
          return withCors(request, response);
        }

        return jsonResponse(
          request,
          {
            ok: false,
            message: "方法不允许",
          },
          405,
        );
      }

      const commentReportMatch = url.pathname.match(
        /^\/api\/comments\/([^/]+)\/report$/,
      );
      if (commentReportMatch) {
        if (request.method === "POST") {
          const response = await reportComment(request, env, commentReportMatch[1]);
          return withCors(request, response);
        }

        return jsonResponse(
          request,
          {
            ok: false,
            message: "方法不允许",
          },
          405,
        );
      }

      const adminStatusMatch = url.pathname.match(
        /^\/api\/admin\/comments\/([^/]+)\/status$/,
      );
      if (adminStatusMatch) {
        if (request.method === "PATCH") {
          const response = await updateAdminCommentStatus(
            request,
            env,
            adminStatusMatch[1],
          );
          return withCors(request, response);
        }

        return jsonResponse(
          request,
          {
            ok: false,
            message: "方法不允许",
          },
          405,
        );
      }

      const adminReportStatusMatch = url.pathname.match(
        /^\/api\/admin\/reports\/([^/]+)\/status$/,
      );
      if (adminReportStatusMatch) {
        if (request.method === "PATCH") {
          const response = await updateAdminReportStatus(
            request,
            env,
            adminReportStatusMatch[1],
          );
          return withCors(request, response);
        }

        return jsonResponse(
          request,
          {
            ok: false,
            message: "方法不允许",
          },
          405,
        );
      }

      const adminCommentMatch = url.pathname.match(
        /^\/api\/admin\/comments\/([^/]+)$/,
      );
      if (adminCommentMatch) {
        if (request.method === "DELETE") {
          const response = await deleteAdminComment(
            request,
            env,
            adminCommentMatch[1],
          );
          return withCors(request, response);
        }

        return jsonResponse(
          request,
          {
            ok: false,
            message: "方法不允许",
          },
          405,
        );
      }

      return jsonResponse(
        request,
        {
          ok: false,
          message: "接口不存在",
        },
        404,
      );
    } catch (error) {
      if (error instanceof ValidationError) {
        return jsonResponse(
          request,
          {
            ok: false,
            message: error.message,
          },
          400,
        );
      }

      if (error instanceof Error && error.message === "INVALID_JSON") {
        return jsonResponse(
          request,
          {
            ok: false,
            message: "请求体必须是合法 JSON",
          },
          400,
        );
      }

      console.error("Unhandled worker error", error);
      return jsonResponse(
        request,
        {
          ok: false,
          message: "服务器错误",
        },
        500,
      );
    }
  },
};

function withCors(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  getCorsHeaders(request).forEach((value, key) => headers.set(key, value));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
