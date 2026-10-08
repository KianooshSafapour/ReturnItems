import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";
import {
  SMS_SETTING_KEYS,
  SMS_PROVIDERS,
  autoSmsSettingsFromMap,
  DEFAULT_CUSTOMER_SUBMIT_TEMPLATE,
  DEFAULT_OWNER_NOTIFY_TEMPLATE,
  getSmsProvider,
  smsAlertConfigFromSettings,
  smsConfigFromSettings,
  smsMissingFields,
  smsReady,
} from "@/lib/sms";

/** ماسک‌کردن مقدار محرمانه — «••••••۱۲۳۴» */
function maskSecret(v: string): string {
  if (!v) return "";
  const tail = v.slice(-4);
  return `••••••${tail}`;
}

async function readSmsSettingsMap(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany({
    where: { key: { in: SMS_SETTING_KEYS as unknown as string[] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

/** ساخت پاسخ پیکربندی (اشتراک GET/PUT) */
function buildConfigPayload(map: Record<string, string>) {
  const cfg = smsConfigFromSettings(map);
  const alert = smsAlertConfigFromSettings(map);
  const auto = autoSmsSettingsFromMap(map);
  return {
    enabled: cfg.enabled,
    provider: cfg.provider,
    sender: cfg.sender ?? "",
    username: cfg.username ?? "",
    hasApiKey: !!cfg.apiKey,
    apiKeyMasked: maskSecret(cfg.apiKey ?? ""),
    hasPassword: !!cfg.password,
    passwordMasked: maskSecret(cfg.password ?? ""),
    customUrl: cfg.customUrl ?? "",
    customMethod: cfg.customMethod ?? "POST",
    customHeaders: cfg.customHeaders ?? "",
    customBody: cfg.customBody ?? "",
    ready: smsReady(cfg),
    missing: smsMissingFields(cfg),
    // هشدار مرجوعی به مدیران (قدیمی)
    alert: {
      enabled: alert.enabled,
      userIds: alert.userIds,
      template: alert.template,
    },
    // پیامک‌های خودکار (لایه ۱ — کلید سراسری هر نوع)
    auto: {
      customerSubmitEnabled: auto.customerSubmitEnabled,
      customerSubmitTemplate: auto.customerSubmitTemplate,
      paymentEnabled: auto.paymentEnabled,
      ownerNotifyEnabled: auto.ownerNotifyEnabled,
      ownerNotifyTemplate: auto.ownerNotifyTemplate,
      includeItems: auto.includeItems,
      defaults: {
        customerSubmitTemplate: DEFAULT_CUSTOMER_SUBMIT_TEMPLATE,
        ownerNotifyTemplate: DEFAULT_OWNER_NOTIFY_TEMPLATE,
      },
    },
    providers: SMS_PROVIDERS.map((p) => ({
      id: p.id,
      label: p.label,
      needs: p.needs,
      hint: p.hint,
      docs: p.docs ?? null,
    })),
  };
}

/** پیکربندی پنل پیامک — فقط مدیران؛ مقادیر محرمانه ماسک می‌شوند */
export async function GET() {
  try {
    await requireOwner();
    const map = await readSmsSettingsMap();
    return jsonOk(buildConfigPayload(map));
  } catch (e) {
    return handleApiError(e);
  }
}

/** ذخیره پیکربندی پنل پیامک — فقط مدیران
 *  قرارداد: فیلد نامعین = بدون تغییر؛ رشته خالی = پاک‌شدن؛ مقدار = تنظیم */
export async function PUT(req: NextRequest) {
  try {
    const manager = await requireOwner();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object")
      return jsonError("بدنه درخواست نامعتبر است");

    // اعتبارسنجی پنل
    if (body.provider !== undefined) {
      const provider = String(body.provider ?? "").trim();
      if (provider !== "" && !getSmsProvider(provider))
        return jsonError("پنل پیامک انتخاب‌شده شناخته نشد");
    }

    // اعتبارسنجی متد سفارشی
    if (body.customMethod !== undefined) {
      const m = String(body.customMethod ?? "POST").toUpperCase();
      if (!["GET", "POST"].includes(m))
        return jsonError("متد درخواست سفارشی فقط GET یا POST می‌تواند باشد");
    }

    // اعتبارسنجی هدرهای سفارشی (JSON)
    if (typeof body.customHeaders === "string" && body.customHeaders.trim() !== "") {
      try {
        const parsed = JSON.parse(body.customHeaders);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          return jsonError("هدرهای سفارشی باید شیء JSON معتبر باشند (مثل {\"Authorization\": \"کلید\"})");
      } catch {
        return jsonError("هدرهای سفارشی JSON معتبر نیستند");
      }
    }
    if (typeof body.customBody === "string" && body.customBody.trim() !== "") {
      try {
        JSON.parse(body.customBody);
      } catch {
        return jsonError("بدنه درخواست سفارشی باید JSON معتبر باشد — از {{message}} برای متن پیام استفاده کنید");
      }
    }

    const fieldMap: Record<string, (v: string) => string> = {
      sms_enabled: (v) => (v === "1" ? "1" : ""),
      sms_provider: (v) => v.slice(0, 20),
      sms_api_key: (v) => v.slice(0, 200),
      sms_username: (v) => v.slice(0, 100),
      sms_password: (v) => v.slice(0, 200),
      sms_sender: (v) => v.slice(0, 30),
      sms_custom_url: (v) => v.slice(0, 500),
      sms_custom_method: (v) => (v.toUpperCase() === "GET" ? "GET" : "POST"),
      sms_custom_headers: (v) => v.slice(0, 2000),
      sms_custom_body: (v) => v.slice(0, 4000),
      sms_alert_enabled: (v) => (v === "1" ? "1" : ""),
      sms_alert_template: (v) => v.slice(0, 612),
      // ---- پیامک‌های خودکار ----
      sms_customer_submit_enabled: (v) => (v === "1" ? "1" : "0"),
      sms_customer_submit_template: (v) => v.slice(0, 612),
      sms_payment_enabled: (v) => (v === "1" ? "1" : "0"),
      sms_owner_notify_enabled: (v) => (v === "1" ? "1" : "0"),
      sms_owner_notify_template: (v) => v.slice(0, 612),
      sms_include_items: (v) => (v === "1" ? "1" : "0"),
    };

    const updates: Array<{ key: string; value: string }> = [];
    const secretKeys = new Set(["sms_api_key", "sms_password"]);
    const keyMap: Record<string, string> = {
      enabled: "sms_enabled",
      provider: "sms_provider",
      apiKey: "sms_api_key",
      username: "sms_username",
      password: "sms_password",
      sender: "sms_sender",
      customUrl: "sms_custom_url",
      customMethod: "sms_custom_method",
      customHeaders: "sms_custom_headers",
      customBody: "sms_custom_body",
      alertEnabled: "sms_alert_enabled",
      alertTemplate: "sms_alert_template",
      // ---- پیامک‌های خودکار ----
      customerSubmitEnabled: "sms_customer_submit_enabled",
      customerSubmitTemplate: "sms_customer_submit_template",
      paymentSmsEnabled: "sms_payment_enabled",
      ownerNotifyEnabled: "sms_owner_notify_enabled",
      ownerNotifyTemplate: "sms_owner_notify_template",
      includeItems: "sms_include_items",
    };
    for (const [bodyKey, settingKey] of Object.entries(keyMap)) {
      const bodyVal = (body as Record<string, unknown>)[bodyKey];
      if (bodyVal === undefined) continue;
      // بولی‌ها به «1»/«0» تبدیل می‌شوند (کلیدهای روشن/خاموش)
      const raw =
        typeof bodyVal === "boolean" ? (bodyVal ? "1" : "0") : String(bodyVal ?? "").trim();
      // مقادیر ماسک‌شده ارسالی از کلاینت نادیده گرفته می‌شوند (بدون تغییر)
      if (secretKeys.has(settingKey) && /^•+/.test(raw)) continue;
      updates.push({ key: settingKey, value: fieldMap[settingKey](raw) });
    }

    // ---- هشدار مرجوعی به مدیران: فهرست مدیران انتخاب‌شده ----
    if (body.alertUserIds !== undefined) {
      let ids: string[] = [];
      if (Array.isArray(body.alertUserIds)) {
        ids = body.alertUserIds
          .map((x: unknown) => String(x ?? "").trim())
          .filter((x: string) => x.length > 0)
          .slice(0, 20);
      }
      // فقط مدیران فعال با نقش owner/admin مجازند هشدار بگیرند
      if (ids.length > 0) {
        const managers = await db.user.findMany({
          where: { id: { in: ids }, isActive: true, role: { in: ["owner", "admin"] } },
          select: { id: true },
        });
        ids = managers.map((m) => m.id);
      }
      updates.push({ key: "sms_alert_user_ids", value: JSON.stringify(ids) });
    }

    if (updates.length === 0)
      return jsonError("هیچ تنظیمی برای ذخیره ارسال نشده است");

    for (const u of updates) {
      await db.setting.upsert({
        where: { key: u.key },
        create: { key: u.key, value: u.value },
        update: { value: u.value },
      });
    }

    await db.activityLog.create({
      data: {
        userId: manager.id,
        action: "sms_config_update",
        detail: `به‌روزرسانی تنظیمات پنل پیامک: ${updates.map((u) => u.key).join("، ")}`,
      },
    });

    const map = await readSmsSettingsMap();
    return jsonOk(buildConfigPayload(map));
  } catch (e) {
    return handleApiError(e);
  }
}
