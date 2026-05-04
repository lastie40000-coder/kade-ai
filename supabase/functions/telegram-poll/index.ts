// Polls Telegram getUpdates for every user bot.
// - Replies via Lovable AI with persona + RAG (top-k from knowledge_chunks).
// - In group chats: only replies on mention/reply, auto-registers groups, runs moderation.
// - In private chats with the bot owner (linked profile): exposes a Rose-style command suite to configure the bot.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RUNTIME_MS = 50_000;
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";
const EMBED_MODEL = "google/text-embedding-004";

const TONES: Record<string, string> = {
  friendly: "Warm, casual, like a helpful community member. Contractions OK. Short sentences. No corporate fluff.",
  professional: "Clear, courteous, business-appropriate. No emoji unless the user uses them first.",
  witty: "Dry, clever, a little playful. Keep it short. Land the joke and move on.",
  strict: "Direct and rule-focused. Short. No padding. Cite the rule when enforcing.",
  hype: "High-energy community vibe. A few emoji are fine. Keep it real, never spammy.",
};

async function tg(token: string, method: string, body: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function send(token: string, chatId: number | string, text: string, replyTo?: number) {
  return tg(token, "sendMessage", {
    chat_id: chatId, text,
    reply_to_message_id: replyTo,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  });
}

async function ragSnippets(supabase: any, botId: string, question: string, k = 6): Promise<string> {
  const q = (question || "").trim();
  if (!q) return "";

  // Try the natural query first.
  let { data } = await supabase.rpc("match_knowledge_chunks_text", {
    _bot_id: botId, _query: q, _match_count: k,
  });

  // If nothing matched, OR-join meaningful tokens and retry — much more forgiving.
  if (!data || data.length === 0) {
    const tokens = q.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w: string) => w.length > 2);
    if (tokens.length > 0) {
      const orQuery = tokens.join(" or ");
      const r = await supabase.rpc("match_knowledge_chunks_text", {
        _bot_id: botId, _query: orQuery, _match_count: k,
      });
      data = r.data;
    }
  }

  // Final fallback: pull a few recent chunks so the bot at least sees some context.
  if (!data || data.length === 0) {
    const { data: recent } = await supabase
      .from("knowledge_chunks")
      .select("content")
      .eq("bot_id", botId)
      .order("created_at", { ascending: false })
      .limit(k);
    if (recent && recent.length > 0) {
      return recent.map((r: any, i: number) => `[${i + 1}] ${r.content}`).join("\n\n").slice(0, 6000);
    }
    return "";
  }

  return data
    .map((r: any, i: number) => `[${i + 1}] ${r.content}`)
    .join("\n\n")
    .slice(0, 6000);
}

async function hasKnowledge(supabase: any, botId: string): Promise<boolean> {
  const { count } = await supabase
    .from("knowledge_chunks")
    .select("id", { count: "exact", head: true })
    .eq("bot_id", botId);
  return (count ?? 0) > 0;
}


function buildSystemPrompt(bot: any, group: any | null, knowledge: string): string {
  const tone = TONES[bot.tone] || TONES.friendly;
  const persona = bot.personality || "";
  const groupCtx = group
    ? `You are currently in the Telegram group "${group.name}".${group.welcome_message ? `\nGroup vibe: ${group.welcome_message}` : ""}${group.rules ? `\nGroup rules:\n${group.rules}` : ""}`
    : "You are in a private chat.";
  const houseRules = bot.house_rules ? `\nHouse rules to follow:\n${bot.house_rules}` : "";
  const customInstr = bot.default_instructions ? `\n\nOwner instructions:\n${bot.default_instructions}` : "";
  const knowledgeBlock = knowledge ? `\n\nUse this knowledge from the workspace when relevant. Quote naturally — do not list source numbers unless asked.\n${knowledge}` : "";

  return `You are *${bot.name}*, a Telegram bot.

Tone: ${tone}
${persona ? `Character: ${persona}\n` : ""}${groupCtx}${houseRules}${customInstr}${knowledgeBlock}

Reply rules:
- Sound like a real person, not an AI assistant. NEVER say "as an AI" or "I'm just an AI".
- Match the user's energy and length. One-liners get one-liners.
- If you don't know something, say so plainly. Don't invent facts.
- Never apologize unprompted. Never say "I hope this helps".
- Keep replies under 4 short sentences unless explicitly asked for detail.
- No bullet lists for casual chat. Save lists for actual lists.
- NEVER claim you "are not an admin" or refuse moderation requests in chat — moderation runs through /ban /kick /mute /del /pin /warn commands. If asked to moderate in conversation, briefly tell the user to reply to the offender's message with one of those commands.`;
}

async function askAI(system: string, userText: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userText },
      ],
    }),
  });
  if (res.status === 429) throw new Error("AI rate limit");
  if (res.status === 402) throw new Error("AI credits exhausted");
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Lovable AI error");
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function getMe(token: string, bot: any, supabase: any): Promise<{ username: string | null; id: number | null }> {
  if (bot.bot_username && bot.bot_telegram_id) {
    return { username: bot.bot_username, id: Number(bot.bot_telegram_id) };
  }
  const me = await tg(token, "getMe", {});
  const username = me.result?.username ?? null;
  const id = me.result?.id ?? null;
  if (username || id) {
    await supabase.from("bots").update({ bot_username: username, bot_telegram_id: id }).eq("id", bot.id);
  }
  return { username, id };
}

async function isGroupAdmin(token: string, chatId: number, userId: number): Promise<boolean> {
  try {
    const r = await tg(token, "getChatMember", { chat_id: chatId, user_id: userId });
    const status = r?.result?.status;
    return status === "creator" || status === "administrator";
  } catch { return false; }
}

async function logMod(supabase: any, bot: any, chatId: number, action: string, opts: any) {
  await supabase.from("moderation_actions").insert({
    bot_id: bot.id, owner_id: bot.owner_id,
    group_chat_id: String(chatId), action,
    target_user: opts.target_user || null,
    target_user_id: opts.target_user_id || null,
    performed_by: opts.performed_by || null,
    reason: opts.reason || null,
    success: opts.success !== false,
    details: opts.details || null,
  });
}

function containsBannedWord(text: string, bannedBot: string[], bannedGroup: string[]): string | null {
  const all = [...(bannedBot || []), ...(bannedGroup || [])].map(w => w.trim().toLowerCase()).filter(Boolean);
  if (all.length === 0) return null;
  const lower = text.toLowerCase();
  return all.find(w => lower.includes(w)) || null;
}

async function ensureGroup(supabase: any, bot: any, msg: any) {
  const chat = msg.chat;
  if (chat.type !== "group" && chat.type !== "supergroup") return null;
  const chatId = String(chat.id);
  const { data: existing } = await supabase.from("telegram_groups").select("*")
    .eq("bot_id", bot.id).eq("telegram_chat_id", chatId).maybeSingle();
  if (existing) {
    await supabase.from("telegram_groups").update({
      name: chat.title || existing.name, last_seen_at: new Date().toISOString(),
    }).eq("id", existing.id);
    return existing;
  }
  const { data: created } = await supabase.from("telegram_groups").insert({
    bot_id: bot.id, owner_id: bot.owner_id,
    name: chat.title || "Untitled group",
    telegram_chat_id: chatId,
    is_auto: true, last_seen_at: new Date().toISOString(),
  }).select("*").single();
  return created;
}

// ----- Owner DM commands (Rose-style) -----
const OWNER_HELP = `*${"{name}"}* — owner controls

Setup:
/settone <friendly|professional|witty|strict|hype>
/setpersona <one-line character description>
/setrules <house rules — multi-line OK>
/setwelcome <welcome message for new members>
/setinstructions <freeform instructions, overrides defaults>

Knowledge:
/addknow <text> — paste a fact or paragraph the bot should know
/addurl <https://...> — index a page

Moderation:
/banword <word>
/unbanword <word>
/banwords — list current banned words
/modon /modoff — toggle moderation in groups

Groups:
/groups — list groups this bot is in
/status — health check
/help — this menu`;

async function handleOwnerDM(supabase: any, bot: any, token: string, msg: any): Promise<boolean> {
  // Only the bot owner (linked Telegram) can configure here.
  const fromId = msg.from?.id;
  if (!fromId) return false;
  const { data: profile } = await supabase.from("profiles").select("id")
    .eq("telegram_user_id", fromId).eq("id", bot.owner_id).maybeSingle();
  if (!profile) return false;

  const text = (msg.text || "").trim();
  const [cmdRaw, ...rest] = text.split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase();
  const arg = text.slice(cmdRaw.length).trim();

  const ack = (m: string) => send(token, msg.chat.id, m, msg.message_id);

  switch (cmd) {
    case "/help":
    case "/start":
      return ack(OWNER_HELP.replaceAll("{name}", bot.name)), true;
    case "/status": {
      const { count: kc } = await supabase.from("knowledge_chunks").select("id", { count: "exact", head: true }).eq("bot_id", bot.id);
      const { count: gc } = await supabase.from("telegram_groups").select("id", { count: "exact", head: true }).eq("bot_id", bot.id);
      return ack(`*${bot.name}* — health\n\n• Status: ${bot.status === "active" ? "🟢 active" : "🟡 paused"}\n• Tone: ${bot.tone || "friendly"}\n• Knowledge chunks: ${kc ?? 0}\n• Groups: ${gc ?? 0}\n• Moderation: ${bot.moderation_enabled ? "on" : "off"}\n• AI: 🟢 Lovable AI Gateway`), true;
    }
    case "/settone": {
      const t = arg.toLowerCase();
      if (!TONES[t]) return ack(`Tones: ${Object.keys(TONES).join(", ")}`), true;
      await supabase.from("bots").update({ tone: t }).eq("id", bot.id);
      return ack(`✅ Tone set to *${t}*.`), true;
    }
    case "/setpersona":
      if (!arg) return ack("Usage: `/setpersona Sassy librarian who loves indie rock`"), true;
      await supabase.from("bots").update({ personality: arg.slice(0, 500) }).eq("id", bot.id);
      return ack("✅ Persona saved."), true;
    case "/setrules":
      await supabase.from("bots").update({ house_rules: arg.slice(0, 2000) }).eq("id", bot.id);
      return ack(arg ? "✅ House rules updated." : "✅ House rules cleared."), true;
    case "/setwelcome":
      await supabase.from("bots").update({ welcome_message: arg.slice(0, 1000) }).eq("id", bot.id);
      return ack(arg ? "✅ Welcome message set." : "✅ Welcome cleared."), true;
    case "/setinstructions":
      await supabase.from("bots").update({ default_instructions: arg.slice(0, 4000) }).eq("id", bot.id);
      return ack(arg ? "✅ Instructions saved." : "✅ Instructions cleared."), true;
    case "/addknow": {
      if (!arg) return ack("Usage: `/addknow Our refund policy is 30 days no questions.`"), true;
      const { data: src } = await supabase.from("knowledge_sources").insert({
        bot_id: bot.id, owner_id: bot.owner_id,
        kind: "text", title: arg.slice(0, 60), content: arg,
      }).select("id").single();
      // Fire-and-forget index
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/index-knowledge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ source_id: src?.id }),
      }).catch(() => {});
      return ack("✅ Saved. Indexing in the background."), true;
    }
    case "/addurl": {
      if (!arg.startsWith("http")) return ack("Usage: `/addurl https://example.com/post`"), true;
      const { data: src } = await supabase.from("knowledge_sources").insert({
        bot_id: bot.id, owner_id: bot.owner_id,
        kind: "url", title: arg.slice(0, 80), source_url: arg,
      }).select("id").single();
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/index-knowledge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ source_id: src?.id }),
      }).catch(() => {});
      return ack("✅ URL queued. Indexing in the background."), true;
    }
    case "/banword": {
      if (!arg) return ack("Usage: `/banword spammer`"), true;
      const next = Array.from(new Set([...(bot.banned_words || []), arg.toLowerCase()]));
      await supabase.from("bots").update({ banned_words: next }).eq("id", bot.id);
      return ack(`✅ Added. Now banning ${next.length} word(s).`), true;
    }
    case "/unbanword": {
      const next = (bot.banned_words || []).filter((w: string) => w !== arg.toLowerCase());
      await supabase.from("bots").update({ banned_words: next }).eq("id", bot.id);
      return ack(`✅ Removed. Now banning ${next.length} word(s).`), true;
    }
    case "/banwords":
      return ack(`Banned words: ${(bot.banned_words || []).join(", ") || "—"}`), true;
    case "/modon":
      await supabase.from("bots").update({ moderation_enabled: true }).eq("id", bot.id);
      return ack("✅ Moderation on."), true;
    case "/modoff":
      await supabase.from("bots").update({ moderation_enabled: false }).eq("id", bot.id);
      return ack("✅ Moderation off."), true;
    case "/groups": {
      const { data: gs } = await supabase.from("telegram_groups").select("name,member_count").eq("bot_id", bot.id);
      const list = (gs || []).map((g: any) => `• ${g.name}${g.member_count ? ` (${g.member_count})` : ""}`).join("\n");
      return ack(`*Groups (${gs?.length ?? 0})*\n\n${list || "—"}`), true;
    }
  }
  return false;
}

// ----- Group moderation commands (admins + bot owner) -----
async function canModerate(supabase: any, bot: any, token: string, chatId: number, fromId: number): Promise<boolean> {
  // Bot owner (linked Telegram) can always moderate
  const { data: profile } = await supabase.from("profiles").select("id")
    .eq("telegram_user_id", fromId).eq("id", bot.owner_id).maybeSingle();
  if (profile) return true;
  return await isGroupAdmin(token, chatId, fromId);
}

async function handleModeration(supabase: any, bot: any, token: string, msg: any): Promise<boolean> {
  const text = (msg.text || "").trim();
  if (!text.startsWith("/")) return false;
  const [cmdRaw] = text.split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase();
  if (!["/ban", "/unban", "/kick", "/mute", "/unmute", "/del", "/delete", "/pin", "/unpin", "/warn"].includes(cmd)) return false;

  const fromId = msg.from?.id;
  const chatId = msg.chat.id;
  if (!fromId || !(await canModerate(supabase, bot, token, chatId, fromId))) {
    await send(token, chatId, "🚫 You don't have moderation rights here.", msg.message_id);
    return true;
  }

  // Most actions need a reply target
  const target = msg.reply_to_message;
  const targetId = target?.from?.id;
  const targetName = target?.from?.username ? `@${target.from.username}` : (target?.from?.first_name || "user");
  const performedBy = msg.from?.username ? `@${msg.from.username}` : (msg.from?.first_name || String(fromId));

  const needsTarget = ["/ban", "/unban", "/kick", "/mute", "/unmute", "/del", "/delete", "/warn"].includes(cmd);
  if (needsTarget && !targetId) {
    await send(token, chatId, `Reply to a user's message and use ${cmd} again.`, msg.message_id);
    return true;
  }

  switch (cmd) {
    case "/ban": {
      const r = await tg(token, "banChatMember", { chat_id: chatId, user_id: targetId });
      const ok = r.ok;
      await logMod(supabase, bot, chatId, "ban", { target_user: targetName, target_user_id: targetId, performed_by: performedBy, success: ok, details: r });
      await send(token, chatId, ok ? `🔨 Banned ${targetName}.` : `❌ Couldn't ban: ${r.description}`, msg.message_id);
      return true;
    }
    case "/unban": {
      const r = await tg(token, "unbanChatMember", { chat_id: chatId, user_id: targetId, only_if_banned: true });
      await logMod(supabase, bot, chatId, "unban", { target_user: targetName, target_user_id: targetId, performed_by: performedBy, success: r.ok });
      await send(token, chatId, r.ok ? `✅ Unbanned ${targetName}.` : `❌ ${r.description}`, msg.message_id);
      return true;
    }
    case "/kick": {
      await tg(token, "banChatMember", { chat_id: chatId, user_id: targetId });
      const r = await tg(token, "unbanChatMember", { chat_id: chatId, user_id: targetId });
      await logMod(supabase, bot, chatId, "kick", { target_user: targetName, target_user_id: targetId, performed_by: performedBy, success: r.ok });
      await send(token, chatId, r.ok ? `👢 Kicked ${targetName}.` : `❌ ${r.description}`, msg.message_id);
      return true;
    }
    case "/mute": {
      const r = await tg(token, "restrictChatMember", {
        chat_id: chatId, user_id: targetId,
        permissions: { can_send_messages: false, can_send_media_messages: false, can_send_other_messages: false },
      });
      await logMod(supabase, bot, chatId, "mute", { target_user: targetName, target_user_id: targetId, performed_by: performedBy, success: r.ok });
      await send(token, chatId, r.ok ? `🔇 Muted ${targetName}.` : `❌ ${r.description}`, msg.message_id);
      return true;
    }
    case "/unmute": {
      const r = await tg(token, "restrictChatMember", {
        chat_id: chatId, user_id: targetId,
        permissions: { can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true, can_send_polls: true, can_add_web_page_previews: true },
      });
      await logMod(supabase, bot, chatId, "unmute", { target_user: targetName, target_user_id: targetId, performed_by: performedBy, success: r.ok });
      await send(token, chatId, r.ok ? `🔊 Unmuted ${targetName}.` : `❌ ${r.description}`, msg.message_id);
      return true;
    }
    case "/del":
    case "/delete": {
      const r = await tg(token, "deleteMessage", { chat_id: chatId, message_id: target.message_id });
      await logMod(supabase, bot, chatId, "delete", { target_user: targetName, target_user_id: targetId, performed_by: performedBy, success: r.ok });
      if (!r.ok) await send(token, chatId, `❌ ${r.description}`, msg.message_id);
      return true;
    }
    case "/pin": {
      const replyTarget = msg.reply_to_message;
      if (!replyTarget) { await send(token, chatId, "Reply to a message and run /pin again.", msg.message_id); return true; }
      const r = await tg(token, "pinChatMessage", { chat_id: chatId, message_id: replyTarget.message_id });
      await logMod(supabase, bot, chatId, "pin", { performed_by: performedBy, success: r.ok });
      await send(token, chatId, r.ok ? "📌 Pinned." : `❌ ${r.description}`, msg.message_id);
      return true;
    }
    case "/unpin": {
      const r = await tg(token, "unpinChatMessage", { chat_id: chatId });
      await logMod(supabase, bot, chatId, "unpin", { performed_by: performedBy, success: r.ok });
      await send(token, chatId, r.ok ? "📌 Unpinned." : `❌ ${r.description}`, msg.message_id);
      return true;
    }
    case "/warn": {
      await logMod(supabase, bot, chatId, "warn", { target_user: targetName, target_user_id: targetId, performed_by: performedBy, success: true });
      await send(token, chatId, `⚠️ ${targetName} has been warned.`, msg.message_id);
      return true;
    }
  }
  return false;
}

async function processBot(supabase: any, bot: any, deadline: number) {
  if (!bot.telegram_bot_token) return { bot: bot.name, skipped: "no token" };
  let offset: number = bot.update_offset || 0;
  let processed = 0;
  const me = await getMe(bot.telegram_bot_token, bot, supabase);

  while (Date.now() < deadline - 3000) {
    const remainingSec = Math.max(1, Math.floor((deadline - Date.now()) / 1000) - 2);
    const timeout = Math.min(25, remainingSec);
    const updatesRes = await tg(bot.telegram_bot_token, "getUpdates", {
      offset, timeout,
      allowed_updates: ["message", "my_chat_member", "new_chat_members", "left_chat_member"],
    });
    if (!updatesRes.ok) return { bot: bot.name, error: updatesRes.description };
    const updates: any[] = updatesRes.result || [];
    if (updates.length === 0) break;

    for (const upd of updates) {
      offset = upd.update_id + 1;

      // Bot was added/removed from a group
      if (upd.my_chat_member) {
        const m = upd.my_chat_member;
        const chat = m.chat;
        if ((chat.type === "group" || chat.type === "supergroup") && m.new_chat_member?.status === "member") {
          await ensureGroup(supabase, bot, { chat });
        }
        continue;
      }

      const msg = upd.message;
      if (!msg) continue;

      // New members → welcome
      if (msg.new_chat_members && msg.new_chat_members.length > 0) {
        const group = await ensureGroup(supabase, bot, msg);
        const tmpl = group?.welcome_message || bot.welcome_message;
        if (tmpl) {
          for (const m of msg.new_chat_members) {
            if (m.id === me.id) continue;
            const name = m.username ? `@${m.username}` : (m.first_name || "friend");
            await send(bot.telegram_bot_token, msg.chat.id,
              tmpl.replaceAll("{name}", name).replaceAll("{group}", msg.chat.title || ""));
          }
        }
        continue;
      }

      if (!msg.text) continue;

      await supabase.from("bot_messages").insert({
        bot_id: bot.id, owner_id: bot.owner_id, direction: "inbound",
        content: msg.text,
        telegram_user: msg.from?.username || msg.from?.first_name || String(msg.from?.id || ""),
      });

      const isPrivate = msg.chat.type === "private";
      const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";

      // 1) Owner DM commands
      if (isPrivate && await handleOwnerDM(supabase, bot, bot.telegram_bot_token, msg)) {
        processed++; continue;
      }

      // 2) Group moderation commands
      if (isGroup && bot.moderation_enabled && await handleModeration(supabase, bot, bot.telegram_bot_token, msg)) {
        processed++; continue;
      }

      // 3) Auto-register group (silent) + auto-filter banned words
      let group: any = null;
      if (isGroup) {
        group = await ensureGroup(supabase, bot, msg);
        if (bot.moderation_enabled && (group?.moderation_enabled !== false)) {
          const hit = containsBannedWord(msg.text, bot.banned_words || [], group?.banned_words || []);
          if (hit) {
            const r = await tg(bot.telegram_bot_token, "deleteMessage", { chat_id: msg.chat.id, message_id: msg.message_id });
            await logMod(supabase, bot, msg.chat.id, "filter_word", {
              target_user: msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name,
              target_user_id: msg.from?.id, reason: hit, success: r.ok,
            });
            continue;
          }
        }
      }

      // Built-in info commands
      const text = msg.text.trim();
      if (text === "/start" || text.startsWith("/start ")) {
        const reply = isPrivate
          ? `👋 Hi! I'm *${bot.name}*. ${bot.personality || "Ask me anything."}\n\nIf you're my owner, send /help for the controls.`
          : `👋 Hello everyone, I'm *${bot.name}*.`;
        await send(bot.telegram_bot_token, msg.chat.id, reply, msg.message_id);
        processed++; continue;
      }
      if (text === "/status") {
        await send(bot.telegram_bot_token, msg.chat.id,
          `*${bot.name}* — ${bot.status === "active" ? "🟢 active" : "🟡 paused"} · AI 🟢`, msg.message_id);
        processed++; continue;
      }
      if (text === "/help" && !isPrivate) {
        await send(bot.telegram_bot_token, msg.chat.id,
          "Mention me or reply to my messages to chat. Admins can use /ban /kick /mute /del /pin (reply to a user's message).", msg.message_id);
        processed++; continue;
      }

      if (bot.status !== "active") continue;

      // In groups, only respond on mention/reply
      if (isGroup) {
        const mentioned = me.username && text.includes(`@${me.username}`);
        const isReply = msg.reply_to_message?.from?.id === me.id;
        if (!mentioned && !isReply) continue;
      }

      try {
        const cleanText = me.username ? text.replaceAll(`@${me.username}`, "").trim() : text;
        const knowledge = await ragSnippets(supabase, bot.id, cleanText, 4);
        const system = buildSystemPrompt(bot, group, knowledge);
        const reply = await askAI(system, cleanText);
        if (reply) {
          await send(bot.telegram_bot_token, msg.chat.id, reply, msg.message_id);
          await supabase.from("bot_messages").insert({
            bot_id: bot.id, owner_id: bot.owner_id, direction: "outbound",
            content: reply, telegram_user: msg.from?.username || null,
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
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: bots, error } = await supabase
    .from("bots")
    .select("*")
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
