 export const getTodayVN = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset(); // phút
    const localTime = new Date(now.getTime() - offset * 60 * 1000);
    return localTime.toISOString().split("T")[0]; // YYYY-MM-DD
  };
  