import { getSessionUser } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await getSessionUser();
    return jsonOk({ user });
  } catch (e) {
    return handleApiError(e);
  }
}
