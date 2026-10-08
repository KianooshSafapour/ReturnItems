import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { handleApiError } from "@/lib/api-helpers";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";

/** پشتیبان‌گیری از پایگاه داده — فقط مدیر ارشد/مالک؛ اسنپ‌شات سازگار با VACUUM INTO */
export async function GET() {
  const tmpPath = join("/tmp", `hz-backup-${Date.now()}-${randomBytes(3).toString("hex")}.db`);
  try {
    const manager = await requireOwner();

    // VACUUM INTO = اسنپ‌شات یکپارچه حتی در حین نوشتن
    await db.$executeRawUnsafe(`VACUUM INTO '${tmpPath}'`);
    const buf = await readFile(tmpPath);

    await db.activityLog.create({
      data: {
        userId: manager.id,
        action: "db_backup",
        detail: `دانلود پشتیبان پایگاه داده (${(buf.length / 1024).toFixed(0)} کیلوبایت)`,
      },
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/x-sqlite3",
        "Content-Disposition": `attachment; filename="hyper-zeytoon-backup-${stamp}.db"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleApiError(e);
  } finally {
    unlink(tmpPath).catch(() => {});
  }
}
