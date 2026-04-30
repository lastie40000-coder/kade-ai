// Polls Telegram getUpdates for every active user bot.
// Generates replies via the Lovable AI Gateway (no per-bot key needed).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RUNTIME_MS = 50_000;
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

async function tg(token: string, method: string, body: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function askLovableAI(system: string, userText: string, knowledge: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const messages = [
    { role: "system", content: system + (knowledge ? `\n\nReference knowledge:\n${knowledge}` : "") },
    { role: "user", content: userText },
  ];
  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: DEFAULT_MODEL, messages }),
  });
  if (res.status === 429) throw new Error("AI rate limit — try again shortly");
  if (res.status === 402) throw new Error("AI credits exhausted — top up in Lovable workspace");
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Lovable AI error");
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function processBot(supabase: any, bot: any, deadline: number) {
  if (!bot.telegram_bot_token) return { bot: bot.name, skipped: "no token" };
  let offset: number = bot.update_offset || 0;
  let processed = 0;

  const { data: knowledgeRows } = await supabase
    .from("knowledge_sources")
    .select("title,content,source_url")
    .eq("bot_id", bot.id)
    .limit(20);
  const knowledge = (knowledgeRows || [])
    .map((k: any) => `# ${k.title}\n${k.content || k.source_url || ""}`)
    .join("\n\n")
    .slice(0, 6000);

  // Cache @username for group mention checks
  let myUsername: string | null = null;

  while (Date.now() < deadline - 3000) {
    const remainingSec = Math.max(1, Math.floor((deadline - Date.now()) / 1000) - 2);
    const timeout = Math.min(25, remainingSec);
    const updatesRes = await tg(bot.telegram_bot_token, "getUpdates", {
      offset, timeout, allowed_updates: ["message"],
    });
    if (!updatesRes.ok) return { bot: bot.name, error: updatesRes.description };
    const updates: any[] = updatesRes.result || [];
    if (updates.length === 0) break;

    for (const upd of updates) {
      offset = upd.update_id + 1;
      const msg = upd.message;
      if (!msg || !msg.text) continue;

      await supabase.from("bot_messages").insert({
        bot_id: bot.id,
        owner_id: bot.owner_id,
        direction: "inbound",
        content: msg.text,
        telegram_user: msg.from?.username || msg.from?.first_name || String(msg.from?.id || ""),
      });

      const text: string = msg.text.trim();

      // --- Built-in commands work even when paused ---
      if (text === "/start" || text.startsWith("/start ")) {
        const reply = `👋 Hello! I'm *${bot.name}*, powered by KADE.\n\nI'm online and connected. Send me a message and I'll do my best to help.\n\nTry /status to check my health or /help to see what I can do.`;
        await tg(bot.telegram_bot_token, "sendMessage", {
          chat_id: msg.chat.id, text: reply, parse_mode: "Markdown",
        });
        await supabase.from("bot_messages").insert({
          bot_id: bot.id, owner_id: bot.owner_id, direction: "outbound", content: reply,
        });
        processed++;
        continue;
      }
      if (text === "/status") {
        const reply = `*${bot.name}* status\n\n• Bot: ${bot.status === "active" ? "🟢 active" : "🟡 paused"}\n• AI: 🟢 Lovable AI Gateway\n• Knowledge entries: ${(knowledgeRows || []).length}\n• Last sync: ${new Date().toUTCString()}`;
        await tg(bot.telegram_bot_token, "sendMessage", {
          chat_id: msg.chat.id, text: reply, parse_mode: "Markdown",
        });
        await supabase.from("bot_messages").insert({
          bot_id: bot.id, owner_id: bot.owner_id, direction: "outbound", content: reply,
        });
        processed++;
        continue;
      }
      if (text === "/help") {
        const reply = `*${bot.name}* — commands\n\n/start — say hello\n/status — health check\n/help — this menu\n\nOr just message me naturally and I'll answer.`;
        await tg(bot.telegram_bot_token, "sendMessage", {
          chat_id: msg.chat.id, text: reply, parse_mode: "Markdown",
        });
        await supabase.from("bot_messages").insert({
          bot_id: bot.id, owner_id: bot.owner_id, direction: "outbound", content: reply,
        });
        processed++;
        continue;
      }

      if (bot.status !== "active") continue;

      // In groups, only reply to mentions or replies
      const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
      if (isGroup) {
        if (!myUsername) {
          const me = await tg(bot.telegram_bot_token, "getMe", {});
          myUsername = me.result?.username || null;
        }
        const mentioned = myUsername && text.includes(`@${myUsername}`);
        const isReply = msg.reply_to_message?.from?.username === myUsername;
        if (!mentioned && !isReply) continue;
      }

      try {
        const system = bot.default_instructions ||
          `You are ${bot.name}, a friendly Telegram support assistant powered by KADE. Be warm, concise, and helpful.`;
        const reply = await askLovableAI(system, text, knowledge);
        if (reply) {
          await tg(bot.telegram_bot_token, "sendMessage", {
            chat_id: msg.chat.id,
            text: reply,
            reply_to_message_id: msg.message_id,
          });
          await supabase.from("bot_messages").insert({
            bot_id: bot.id,
            owner_id: bot.owner_id,
            direction: "outbound",
            content: reply,
            telegram_user: msg.from?.username || null,
          });
        }
      } catch (e) {
        console.error(`bot ${bot.name} reply failed:`, (e as Error).message);
      }
      processed++;
    }

    await supabase.from("bots").update({ update_offset: offset }).eq("id", bot.id);
  }

  return { bot: bot.name, processed, offset };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: bots, error } = await supabase
    .from("bots")
    .select("id,name,owner_id,telegram_bot_token,default_instructions,status,update_offset")
    .not("telegram_bot_token", "is", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const deadline = Date.now() + MAX_RUNTIME_MS;
  const results = await Promise.all(
    (bots || []).map((b) =>
      processBot(supabase, b, deadline).catch((e) => ({ bot: b.name, error: e.message }))
    )
  );

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
