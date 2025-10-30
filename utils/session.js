// utils/session.js
let unlocked = false;

export const setUnlocked = (val) => {
  unlocked = !!val;
};

export const isUnlocked = () => unlocked;