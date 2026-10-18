import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getAdditionalUserInfo, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCOYOY7bxb7Xj1wXR7t5mo4HWP6dh6ytrM",
  authDomain: "vish-hub.firebaseapp.com",
  projectId: "vish-hub",
  storageBucket: "vish-hub.firebasestorage.app",
  messagingSenderId: "287693072826",
  appId: "1:287693072826:web:4870d52e1eb074c1395583",
  measurementId: "G-E23PGJCKZT"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const profilesKey = 'vishHubFirebaseProfilesV1';
const guestModeKey = 'vishHubGuestModeV1';
let guestMode = localStorage.getItem(guestModeKey) === 'true';
const byId = (id) => document.getElementById(id);
let activeUser = auth.currentUser || null;
let authResolved = false;

const readJson = (key, fallback) => {
  try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback; }
  catch { return fallback; }
};
const readProfiles = () => readJson(profilesKey, {});
const saveProfiles = (profiles) => localStorage.setItem(profilesKey, JSON.stringify(profiles));
const removeLegacyStudentIds = () => {
  const profiles = readProfiles();
  let changed = false;
  Object.values(profiles).forEach((profile) => {
    if (!profile || typeof profile !== 'object') return;
    ['rollNo', 'rollNumber', 'prn'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(profile, key)) {
        delete profile[key];
        changed = true;
      }
    });
  });
  if (changed) saveProfiles(profiles);
};
removeLegacyStudentIds();
const progressKey = (base, uid) => `${base}:${uid}`;
const accountProgress = (uid) => ({
  quizScores: readJson(progressKey('vishHubQuizScoreboardV1', uid), []),
  focus: readJson(progressKey('vishHubFocusV1', uid), { goal: 3, days: {} })
});
const setMessage = (message, error = false) => {
  const target = byId('profileFeedback');
  if (!target) return;
  const emailView = byId('authEmailView');
  const methodView = byId('authMethodView');
  const form = byId('profileAuthForm');
  if (emailView && !emailView.hidden && form) {
    const submit = byId('profileAuthSubmit');
    if (submit?.nextElementSibling !== target) submit?.insertAdjacentElement('afterend', target);
  } else if (methodView && !methodView.hidden && !methodView.contains(target)) {
    methodView.append(target);
  }
  target.textContent = message;
  target.classList.toggle('error', error);
  target.classList.toggle('success', Boolean(message) && !error);
};
const flashButton = (button, label, success, restoreHtml, duration = 2400) => {
  if (!button) return;
  clearTimeout(button._feedbackTimer);
  button.innerHTML = label;
  button.classList.toggle('action-success', success);
  button.classList.toggle('action-error', !success);
  button._feedbackTimer = window.setTimeout(() => {
    button.innerHTML = restoreHtml;
    button.classList.remove('action-success', 'action-error');
  }, duration);
};
const notifyApp = (message, error = false) => window.dispatchEvent(new CustomEvent('vishhub-action-notice', { detail: { message, error } }));
const friendlyError = (error) => {
  const messages = {
    'auth/email-already-in-use': 'An account already uses this email. Log in instead.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/weak-password': 'Choose a stronger password with at least 6 characters.',
    'auth/invalid-credential': 'We could not sign you in. Check your email and password, or choose Sign Up if you have not created an account yet.',
    'auth/user-not-found': 'No account was found for this email. Choose Sign Up to create one first.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/popup-closed-by-user': 'The Google sign-in window was closed before sign-in finished.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Try again or allow pop-ups.',
    'auth/unauthorized-domain': 'This website is not authorized in Firebase yet. Add its domain under Authentication settings.',
    'auth/operation-not-allowed': 'Enable Email/Password and Google providers in Firebase Authentication settings.',
    'auth/network-request-failed': 'Could not reach Firebase. Check your connection and try again.'
  };
  return messages[error?.code] || error?.message || 'Could not complete sign-in. Please try again.';
};
const setAppAccess = (user) => {
  if (user) { guestMode = false; localStorage.removeItem(guestModeKey); }
  const allowed = Boolean(user) || guestMode;
  document.body.dataset.authReady = String(authResolved);
  document.body.dataset.authUser = String(allowed);
  const main = document.querySelector('main.app');
  if (main) main.toggleAttribute('inert', !allowed);
  const profilePage = byId('studentProfilePage');
  const profileScrim = byId('profileScrim');
  if (!allowed) {
    profilePage?.classList.add('open');
    profileScrim?.classList.add('open');
    document.body.style.overflow = 'hidden';
  } else {
    profilePage?.classList.remove('open');
    profileScrim?.classList.remove('open');
    document.body.style.overflow = '';
  }
};
const emitAuthState = (user) => {
  const profile = user ? (readProfiles()[user.uid] || {}) : null;
  window.dispatchEvent(new CustomEvent('vishhub-auth-state', {
    detail: user ? {
      user: { uid: user.uid, displayName: user.displayName || profile.name || 'Student', email: user.email || '' },
      profile,
      profileComplete: profile.profileComplete === true || (profile.profileComplete !== false && Boolean(profile.name && profile.course)),
      progress: accountProgress(user.uid)
    } : { user: null, profile: null, progress: null, guest: guestMode, guestProfile: readJson('vishHubGuestProfileV1', {}), progress: guestMode ? accountProgress('guest') : null }
  }));
};

window.vishHubAuth = {
  isSignedIn: () => Boolean(activeUser),
  isGuest: () => guestMode && !activeUser,
  continueAsGuest: () => {
    guestMode = true;
    localStorage.setItem(guestModeKey, 'true');
    setAppAccess(null);
    emitAuthState(null);
    window.dispatchEvent(new CustomEvent('vishhub-guest-continued'));
  },
  getCurrentProfile: () => {
    const user = auth.currentUser || activeUser;
    if (!user) return null;
    const profile = readProfiles()[user.uid] || {};
    return {
      user: { uid: user.uid, displayName: user.displayName || profile.name || 'Student', email: user.email || '' },
      profile,
      profileComplete: profile.profileComplete === true || (profile.profileComplete !== false && Boolean(profile.name && profile.course))
    };
  },
  saveProfile: async (profile) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Log in to save your profile.');
    const existing = readProfiles();
    existing[user.uid] = { ...existing[user.uid], ...profile, profileComplete: true };
    if (profile.name && profile.name !== user.displayName) await updateProfile(user, { displayName: profile.name });
    saveProfiles(existing);
    emitAuthState(user);
    return existing[user.uid];
  },
  signOut: async () => { guestMode = false; localStorage.removeItem(guestModeKey); await signOut(auth); },
  recordQuizScore: async (record) => {
    const user = auth.currentUser;
    if (!user) return null;
    const key = progressKey('vishHubQuizScoreboardV1', user.uid), scores = readJson(key, []);
    scores.push(record); localStorage.setItem(key, JSON.stringify(scores)); return record;
  },
  recordFocusSession: async (date) => {
    const user = auth.currentUser;
    if (!user) return null;
    const key = progressKey('vishHubFocusV1', user.uid), focus = readJson(key, { goal: 3, days: {} });
    focus.days = focus.days || {}; focus.days[date] = Number(focus.days[date] || 0) + 1;
    localStorage.setItem(key, JSON.stringify(focus)); return focus;
  },
  setFocusGoal: async (goal) => {
    const user = auth.currentUser;
    if (!user) return;
    const key = progressKey('vishHubFocusV1', user.uid), focus = readJson(key, { goal: 3, days: {} });
    focus.goal = Math.max(1, Math.min(5, Number(goal) || 3));
    localStorage.setItem(key, JSON.stringify(focus));
  }
};

const persistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Firebase auth persistence could not be configured.', error);
});
const redirectAdminIfAuthorized = async (user) => {
  if (!user || window.location.pathname.startsWith('/admin')) return;
  try {
    const token = await user.getIdToken();
    const response = await fetch('/api/admin-access', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
    if (response.ok) window.location.assign('/admin');
  } catch (error) {
    console.info('Could not check admin access after sign-in.', error);
  }
};
if (await isSupported().catch(() => false)) {
  try { getAnalytics(app); } catch (error) { console.info('Firebase Analytics is unavailable in this browser.', error); }
}

byId('profileAuthForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = byId('profileAuthSubmit');
  const signup = document.querySelector('[data-auth-mode="signup"].active') !== null;
  const email = byId('authEmail')?.value.trim().toLowerCase() || '';
  const password = byId('authPassword')?.value || '';
  const confirm = byId('authPasswordConfirm')?.value || '';
  const originalSubmit = submit?.innerHTML || '';
  let resultLabel = '';
  if (submit) { submit.disabled = true; submit.innerHTML = signup ? 'Creating account…' : 'Signing in…'; }
  try {
    await persistenceReady;
    if (!email) throw new Error('Enter your email address.');
    if (password.length < 6) throw new Error('Use a password with at least 6 characters.');
    if (signup && password !== confirm) throw new Error('Passwords do not match.');
    if (signup) {
      const name = byId('authName')?.value.trim() || '';
      if (!name) throw new Error('Enter your name.');
      setMessage('Creating your Firebase account…');
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      const profiles = readProfiles();
      profiles[credential.user.uid] = { ...profiles[credential.user.uid], name, course: byId('authCourse')?.value.trim() || 'FYBA · First Year', profileComplete: false };
      saveProfiles(profiles);
      emitAuthState(credential.user);
      window.dispatchEvent(new CustomEvent('vishhub-account-created', { detail: { name } }));
      setMessage('Account created successfully. Your profile is ready to personalize.');
      resultLabel = 'Account created <span>✓</span>';
    } else {
      setMessage('Signing in securely…');
      await signInWithEmailAndPassword(auth, email, password);
      setMessage('You’re signed in.');
      window.dispatchEvent(new CustomEvent('vishhub-signin-success'));
      notifyApp('Signed in successfully.');
      resultLabel = 'Signed in <span>✓</span>';
    }
  } catch (error) {
    setMessage(friendlyError(error), true);
    notifyApp(friendlyError(error), true);
    resultLabel = 'Try again <span>↻</span>';
  } finally {
    if (submit) { submit.disabled = false; flashButton(submit, resultLabel || originalSubmit, Boolean(resultLabel && !resultLabel.startsWith('Try again')), originalSubmit); }
  }
});


byId('authPasswordToggle')?.addEventListener('click', (event) => {
  const button = event.currentTarget;
  const input = byId(button.dataset.passwordTarget || 'authPassword');
  if (!input) return;
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  button.textContent = reveal ? 'Hide' : 'Show';
  button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
});
byId('authPasswordConfirmToggle')?.addEventListener('click', (event) => {
  const button = event.currentTarget;
  const input = byId(button.dataset.passwordTarget || 'authPasswordConfirm');
  if (!input) return;
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  button.textContent = reveal ? 'Hide' : 'Show';
  button.setAttribute('aria-label', reveal ? 'Hide password confirmation' : 'Show password confirmation');
});
byId('authForgotPassword')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const email = byId('authEmail')?.value.trim().toLowerCase() || '';
  if (!email) {
    byId('authEmail')?.focus();
    setMessage('Enter your email address above, then choose Forgot password.');
    return;
  }
  button.disabled = true;
  setMessage('Sending password reset email…');
  try {
    await persistenceReady;
    await sendPasswordResetEmail(auth, email);
    setMessage('Password reset link sent. Check your inbox and spam folder.');
    notifyApp('Password reset link sent. Check your inbox.');
  } catch (error) {
    setMessage(friendlyError(error), true);
    notifyApp(friendlyError(error), true);
  } finally {
    button.disabled = false;
  }
});
const handleGoogleSignIn = async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  const originalLabel = button.innerHTML;
  try {
    await persistenceReady;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    setMessage('Connecting to Google…');
    button.textContent = 'Connecting to Google…';
    try {
      const credential = await signInWithPopup(auth, provider);
      if (getAdditionalUserInfo(credential)?.isNewUser) {
        window.dispatchEvent(new CustomEvent('vishhub-account-created', { detail: { name: credential.user.displayName || '' } }));
      } else {
        setMessage('You’re signed in with Google.');
      }
    }
    catch (error) {
      if (error?.code === 'auth/popup-blocked') { await signInWithRedirect(auth, provider); return; }
      throw error;
    }
    setMessage('You’re signed in with Google.');
    window.dispatchEvent(new CustomEvent('vishhub-signin-success'));
    notifyApp('Signed in with Google.');
    flashButton(button, 'Signed in with Google <span>✓</span>', true, originalLabel);
  } catch (error) {
    setMessage(friendlyError(error), true);
    notifyApp(friendlyError(error), true);
    flashButton(button, 'Try Google again <span>↻</span>', false, originalLabel);
  } finally {
    button.disabled = false;
  }
};
[byId('googleSignInButton'), byId('googleSignInInlineButton')].forEach((button) => button?.addEventListener('click', handleGoogleSignIn));
onAuthStateChanged(auth, (user) => {
  activeUser = user;
  if (user) { guestMode = false; localStorage.removeItem(guestModeKey); }
  authResolved = true;
  setAppAccess(user);
  emitAuthState(user);
  if (user) void redirectAdminIfAuthorized(user);
});
