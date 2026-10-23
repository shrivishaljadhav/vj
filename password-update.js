import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  getAuth,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  checkActionCode
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

const root = document.querySelector("[data-password-action-root]");
if (root) {
  const firebaseConfig = {
    apiKey: "AIzaSyCOYOY7bxb7Xj1wXR7t5mo4HWP6dh6ytrM",
    authDomain: "vish-hub.firebaseapp.com",
    projectId: "vish-hub",
    storageBucket: "vish-hub.firebasestorage.app",
    messagingSenderId: "287693072826",
    appId: "1:287693072826:web:4870d52e1eb074c1395583",
    measurementId: "G-E23PGJCKZT"
  };
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode");
  const actionCode = params.get("oobCode");
  const title = root.querySelector("[data-action-title]");
  const intro = root.querySelector("[data-action-intro]");
  const emailBox = root.querySelector("[data-action-email]");
  const form = root.querySelector("[data-password-form]");
  const message = root.querySelector("[data-action-message]");
  const card = root.querySelector("[data-action-card]");
  const backLink = root.querySelector("[data-back-link]");

  if (mode || actionCode) {
    if (root.id === "passwordActionPage") {
      root.hidden = false;
      document.body.classList.add("password-action-open");
      document.title = "Account Security · VISH HUB";
    }
    function showMessage(text, isError = false) {
      message.textContent = text;
      message.classList.toggle("error", isError);
    }
    function showInvalid(text = "This link is invalid or has expired. Request a new password reset email and try again.") {
      form.hidden = true;
      title.textContent = "This link can’t be used";
      intro.textContent = "For your account’s security, password links can only be used once and expire after a while.";
      showMessage(text, true);
      backLink.textContent = "Return to VISH HUB and request a new link";
    }
    function showSuccess(heading, copy) {
      card.dataset.state = "success";
      form.hidden = true;
      emailBox.hidden = true;
      title.textContent = heading;
      intro.textContent = copy;
      showMessage("");
      backLink.textContent = "Continue to VISH HUB";
    }

    root.querySelectorAll("[data-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = root.querySelector(button.dataset.toggle === "new-password" ? "[data-new-password]" : "[data-confirm-password]");
        const reveal = input.type === "password";
        input.type = reveal ? "text" : "password";
        button.textContent = reveal ? "Hide" : "Show";
      });
    });

    if (!actionCode) {
      showInvalid("Open the complete link from your email. If needed, return to VISH HUB and request another.");
    } else if (mode === "resetPassword") {
      title.textContent = "Update your password";
      verifyPasswordResetCode(auth, actionCode)
        .then((email) => {
          emailBox.textContent = email;
          emailBox.hidden = false;
          form.hidden = false;
        })
        .catch((error) => {
          console.error("Password reset link validation failed.", error);
          showInvalid();
        });
    } else if (mode === "verifyEmail") {
      title.textContent = "Confirming your email";
      intro.textContent = "We’re verifying this email address for your VISH HUB account.";
      form.hidden = true;
      applyActionCode(auth, actionCode)
        .then(() => showSuccess("Email verified", "Your email address is confirmed. You can now sign in to VISH HUB."))
        .catch((error) => {
          console.error("Email verification link failed.", error);
          showInvalid("This email verification link is invalid, expired, or has already been used. Sign in and request a new verification email.");
        });
    } else if (mode === "recoverEmail") {
      title.textContent = "Restoring your account email";
      intro.textContent = "We’re checking this account recovery link.";
      form.hidden = true;
      checkActionCode(auth, actionCode)
        .then(() => applyActionCode(auth, actionCode))
        .then(() => showSuccess("Email restored", "The account email change has been reverted. You can now return to VISH HUB."))
        .catch((error) => {
          console.error("Email recovery link failed.", error);
          showInvalid("This account recovery link is invalid or expired.");
        });
    } else {
      showInvalid("This link type isn’t supported here. Return to VISH HUB to continue.");
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = root.querySelector("[data-new-password]").value;
      const confirmation = root.querySelector("[data-confirm-password]").value;
      const button = root.querySelector("[data-update-button]");
      if (password.length < 6) {
        showMessage("Choose a password with at least 6 characters.", true);
        return;
      }
      if (password !== confirmation) {
        showMessage("The passwords don’t match. Check them and try again.", true);
        return;
      }
      button.disabled = true;
      button.textContent = "Updating password…";
      showMessage("");
      try {
        await confirmPasswordReset(auth, actionCode, password);
        showSuccess("Password updated", "Your new password is ready. Sign in to VISH HUB with it.");
      } catch (error) {
        console.error("Password update failed.", error);
        const errors = {
          "auth/expired-action-code": "This reset link has expired. Request a new one from the sign-in page.",
          "auth/invalid-action-code": "This reset link has already been used or is invalid. Request a new one.",
          "auth/weak-password": "Choose a stronger password with at least 6 characters."
        };
        showMessage(errors[error?.code] || "We couldn’t update the password. Please try again or request a new reset link.", true);
        button.disabled = false;
        button.textContent = "Save new password";
      }
    });
  }
}