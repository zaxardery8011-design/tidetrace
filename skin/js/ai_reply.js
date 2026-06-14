(function () {
  "use strict";

  const s = () => window.TT_STATE;
  const q = () => window.TT_SELECTORS;

  function t(key, placeholders = null) {
    return window.TT_Content.t(key, placeholders);
  }

  function getArticleText(article) {
    const clone = article.cloneNode(true);
    clone.querySelectorAll(q().textNoise.join(",")).forEach((element) => element.remove());
    return (clone.innerText || clone.textContent || "").trim().substring(0, 600);
  }

  async function callAI(postContent, customSystemPrompt = null, modelOverride = null) {
    const state = s();
    const apiKey = state.aiApiKeys[state.aiProvider];
    if (!apiKey) throw new Error(t("aiNoKeyError"));

    const systemPrompt = customSystemPrompt ||
      "You are a professional social media editor. Generate three concise replies for the following Threads post. Each reply must be under 50 words. " +
      `Use this exact format:\n【${t("aiTypeFriendly")}】reply\n【${t("aiTypeProfessional")}】reply\n【${t("aiTypeQuestion")}】reply`;
    const userMessage = `Post content:\n${postContent}`;

    if (state.aiProvider === "gemini") {
      const model = modelOverride || state.geminiModel || "gemini-2.0-flash";
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userMessage }] }]
          })
        }
      );

      if (!response.ok) {
        let detail = "";
        try {
          const errorData = await response.json();
          detail = errorData?.error?.message || "";
        } catch (_) {}
        if (response.status === 503) throw new Error(t("aiGemini503"));
        if (response.status === 400) throw new Error(t("aiGemini400"));
        if (response.status === 429) throw new Error(t("aiGemini429"));
        throw new Error(`Gemini ${response.status}: ${detail || t("aiUnknownError")}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error(t("aiUnknownError"));
      return text;
    }

    if (state.aiProvider === "openai") {
      const model = modelOverride || state.openaiModel || "gpt-4o-mini";
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          max_tokens: 400
        })
      });

      if (!response.ok) throw new Error(`OpenAI ${response.status}`);
      const data = await response.json();
      return data?.choices?.[0]?.message?.content || "";
    }

    if (state.aiProvider === "claude") {
      const model = modelOverride || state.claudeModel || "claude-3-5-sonnet-latest";
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model,
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }]
        })
      });

      if (!response.ok) throw new Error(`Claude ${response.status}`);
      const data = await response.json();
      return data?.content?.[0]?.text || "";
    }

    throw new Error(t("aiUnknownProvider"));
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function parseAiReplies(text) {
    return [t("aiTypeFriendly"), t("aiTypeProfessional"), t("aiTypeQuestion")].map((label) => {
      const pattern = new RegExp(`【${escapeRegExp(label)}】[（(]?([\\s\\S]*?)(?=【|$)`);
      const match = text.match(pattern);
      return {
        label,
        text: match ? match[1].replace(/[）)]\s*$/, "").trim() : ""
      };
    }).filter((reply) => reply.text.length > 0);
  }

  async function fetchAiReplies(article, postId, dropdown) {
    dropdown.innerHTML = "";
    const loading = document.createElement("div");
    loading.className = "tt-reply-empty";
    loading.textContent = t("statusAiGenerating");
    dropdown.appendChild(loading);

    try {
      const rawText = await callAI(getArticleText(article));
      const replies = parseAiReplies(rawText);
      dropdown.innerHTML = "";

      if (replies.length === 0) {
        const item = document.createElement("div");
        item.className = "tt-reply-item";
        item.textContent = rawText.trim().substring(0, 160);
        item.addEventListener("click", (event) => {
          event.stopPropagation();
          dropdown.style.display = "none";
          if (window.TT_PATROL) window.TT_PATROL.executeReply(rawText.trim(), postId, article);
        });
        dropdown.appendChild(item);
        return;
      }

      replies.forEach((reply) => {
        const item = document.createElement("div");
        item.className = "tt-reply-item";

        const label = document.createElement("span");
        label.style.color = "var(--tt-accent)";
        label.style.fontSize = "10px";
        label.style.fontWeight = "700";
        label.style.marginRight = "5px";
        label.textContent = `[${reply.label}]`;

        item.appendChild(label);
        item.appendChild(document.createTextNode(reply.text));
        item.addEventListener("click", (event) => {
          event.stopPropagation();
          dropdown.style.display = "none";
          if (window.TT_PATROL) window.TT_PATROL.executeReply(reply.text, postId, article);
        });
        dropdown.appendChild(item);
      });
    } catch (error) {
      dropdown.innerHTML = "";
      const message = document.createElement("div");
      message.className = "tt-reply-empty";
      message.style.color = "var(--tt-danger)";
      message.textContent = t("aiError", [error.message]);
      dropdown.appendChild(message);
    }
  }

  window.TT_AI = {
    getArticleText,
    callAI,
    parseAiReplies,
    fetchAiReplies
  };
})();
