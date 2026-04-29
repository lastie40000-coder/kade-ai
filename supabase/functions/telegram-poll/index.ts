// Polls Telegram getUpdates for every active bot, replies via OpenAI, logs messages.
// Runs every minute via pg_cron. Each invocation runs ~50s to give near-real-time replies.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RUNTIME_MS = 50_000;

async function tg(token: string, method: string, body: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function askOpenAI(apiKey: string, system: string, userText: string, knowledge: string): Promise<string> {
  const messages = [
    { role: "system", content: system + (knowledge ? `\n\nReference knowledge:\n${knowledge}` : "") },
    { role: "user", content: userText },
  ];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 500, temperature: 0.7 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "OpenAI error");
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function processBot(supabase: any, bot: any, deadline: number) {
  if (!bot.telegram_bot_token) return { bot: bot.name, skipped: "no token" };
  let offset: number = bot.update_offset || 0;
  let processed = 0;

  // Load knowledge once per bot run
  const { data: knowledgeRows } = await supabase
    .from("knowledge_sources")
    .select("title,content,source_url")
    .eq("bot_id", bot.id)
    .limit(20);
  const knowledge = (knowledgeRows || [])
    .map((k: any) => `# ${k.title}\n${k.content || k.source_url || ""}`)
    .join("\n\n")
    .slice(0, 6000);

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

      // Log inbound
      await supabase.from("bot_messages").insert({
        bot_id: bot.id,
        owner_id: bot.owner_id,
        direction: "inbound",
        content: msg.text,
        telegram_user: msg.from?.username || msg.from?.first_name || String(msg.from?.id || ""),
      });

      if (bot.status !== "active") continue;
      if (!bot.openai_api_key) continue;

      // In groups, only reply to mentions or replies to the bot
      const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
      if (isGroup) {
        const me = await tg(bot.telegram_bot_token, "getMe", {});
        const username = me.result?.username;
        const mentioned = username && msg.text.includes(`@${username}`);
        const isReply = msg.reply_to_message?.from?.username === username;
        if (!mentioned && !isReply) continue;
      }

      try {
        const system = bot.default_instructions || `You are ${bot.name}, a friendly Telegram support assistant. Be warm, concise, and helpful.`;
        const reply = await askOpenAI(bot.openai_api_key, system, msg.text, knowledge);
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

    // Persist offset after each batch
    await supabase.from("bots").update({ update_offset: offset }).eq("id", bot.id);
  }

  return { bot: bot.name, processed, offset };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: bots, error } = await supabase
    .from("bots")
    .select("id,name,owner_id,telegram_bot_token,openai_api_key,default_instructions,status,update_offset")
    .not("telegram_bot_token", "is", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const deadline = Date.now() + MAX_RUNTIME_MS;
  // Run all bots in parallel so one slow bot doesn't block others
  const results = await Promise.all((bots || []).map((b) => processBot(supabase, b, deadline).catch((e) => ({ bot: b.name, error: e.message }))));

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
