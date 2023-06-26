import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Context } from "koa";
import { database } from "../config/database";
import { ApiKeyTable, UserTable } from "../types";
import { JwtPayload } from 'jsonwebtoken';

/**
 * Create API key
 * @param ctx 
 */
export const createApiKey = async (ctx: Context) => {
  try {
    const { body } = ctx.request;
    const uuid = uuidv4();
    const key = randomBytes(16).toString('base64url');

    await database<ApiKeyTable>('api_keys').insert({
      uuid,
      name: body.name,
      key,
      user_id: ctx.state.user.sub
    });

    const apiKey = await database<ApiKeyTable>('api_keys').where('uuid', uuid).first();
    ctx.body = {
      apiKey
    };
  } catch (error) {
    // Handle the error appropriately (e.g., log, send error response)
    console.error(error);
    ctx.throw(500, "Internal Server Error");
  }
};

/**
 * Get all API Keys for a user
 * @param ctx 
 */
export const getUserApiKeys = async (ctx: Context) => {
  try {
    const user: JwtPayload = ctx.state.user;
    const apiKeys = await database<ApiKeyTable>('api_keys')
      .where('user_id', user.sub)
      .select('*');

    const data = apiKeys.map((apiKey) => {
      const { user_id, ...attributes } = apiKey;
      return {
        type: "apiKeys",
        uuid: apiKey.uuid,
        attributes
      };
    });

    ctx.header['content-type'] = 'application/vnd.api+json';
    ctx.body = {
      data
    };
  } catch (error) {
    // Handle the error appropriately (e.g., log, send error response)
    console.error(error);
    ctx.throw(500, "Internal Server Error");
  }
};

/**
 * Delete a given API Key
 * @param ctx 
 */
export const deleteApiKey = async (ctx: Context) => {
  try {
    const apiKeyParam = ctx.params.uuid;
    const apiKey = await database<ApiKeyTable>('api_keys').where('uuid', apiKeyParam).first();

    if (!apiKey) {
      return sendNotFoundResponse(apiKeyParam);
    }

    if (apiKey.user_id === ctx.state.user.sub) {
      await database<ApiKeyTable>('api_keys').where('uuid', apiKeyParam).delete();
      ctx.body = {
        data: "Key deleted."
      };
      return;
    }

    sendUnauthorizedResponse();

  } catch (error) {
    // Handle the error appropriately (e.g., log, send error response)
    console.error(error);
    ctx.throw(500, "Internal Server Error");
  }

  function sendNotFoundResponse(apiKeyParam: string) {
    ctx.status = 404;
    ctx.header['content-type'] = 'application/vnd.api+json';

    ctx.body = {
      errors: [
        {
          source: { parameter: "uuid" },
          title: "Not found error.",
          detail: `API key with id ${apiKeyParam} was not found.`
        }
      ]
    };
  }

  function sendUnauthorizedResponse() {
    ctx.status = 403;
    ctx.header['content-type'] = 'application/vnd.api+json';

    ctx.body = {
      errors: [
        {
          status: 403,
          title: "Unauthorized error.",
          detail: "You are not authorized to delete this API key."
        }
      ]
    };
  }
};
