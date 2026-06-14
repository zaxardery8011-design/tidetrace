(function () {
  "use strict";

  const CHROME_API = typeof browser !== "undefined" ? browser : chrome;

  window.TT_UI = {
    createFloatingButton() {
      if (document.getElementById("tidetrace-ball")) return;

      const ball = document.createElement("button");
      ball.id = "tidetrace-ball";
      ball.type = "button";
      ball.setAttribute("aria-label", "Tidetrace");
      ball.style.backgroundImage = `url(${CHROME_API.runtime.getURL("icons/icon48.png")})`;

      let isDragging = false;
      let hasMoved = false;

      ball.addEventListener("mousedown", (event) => {
        isDragging = true;
        hasMoved = false;
        ball.classList.add("tt-dragging");
        const rect = ball.getBoundingClientRect();
        const shiftX = event.clientX - rect.left;
        const shiftY = event.clientY - rect.top;

        function onMouseMove(moveEvent) {
          if (!isDragging) return;
          hasMoved = true;
          ball.style.left = `${moveEvent.clientX - shiftX}px`;
          ball.style.top = `${moveEvent.clientY - shiftY}px`;
          ball.style.right = "auto";
          window.TT_UI.updatePanelPosition();
        }

        function onMouseUp() {
          isDragging = false;
          ball.classList.remove("tt-dragging");
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
        }

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });

      ball.addEventListener("click", () => {
        if (hasMoved) return;
        const panel = document.getElementById("tidetrace-panel");
        if (!panel) return;
        const shouldShow = panel.hidden;
        panel.hidden = !shouldShow;
        if (shouldShow) window.TT_UI.updatePanelPosition();
      });

      document.body.appendChild(ball);
    },

    updatePanelPosition() {
      const ball = document.getElementById("tidetrace-ball");
      const panel = document.getElementById("tidetrace-panel");
      if (!ball || !panel || panel.hidden) return;

      const rect = ball.getBoundingClientRect();
      panel.style.top = `${rect.bottom + 10}px`;
      const isRightSide = rect.left + rect.width / 2 > window.innerWidth / 2;
      if (isRightSide) {
        panel.style.left = "auto";
        panel.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
      } else {
        panel.style.left = `${Math.max(8, rect.left)}px`;
        panel.style.right = "auto";
      }
    }
  };
})();
