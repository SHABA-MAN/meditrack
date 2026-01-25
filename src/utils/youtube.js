export const getVideoId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export const getPlaylistId = (url) => {
  if (!url) return null;
  const regExp = /[?&]list=([^#&?]+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
};

export const ytRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^\s]+)/g;
