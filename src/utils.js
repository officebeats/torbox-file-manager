export const suggestFolder = (torrentName, folders) => {
  if (!torrentName) return null;
  const name = torrentName.toLowerCase();
  
  // Basic heuristics
  const isTVShow = /s\d\de\d\d/.test(name) || /season\s\d/.test(name) || /episode\s\d/.test(name);
  const isMovie = (name.includes('1080p') || name.includes('2160p') || name.includes('720p')) && !isTVShow;
  const isMusic = name.endsWith('.mp3') || name.endsWith('.flac') || name.includes('discography');
  
  let suggestion = null;
  if (isTVShow) suggestion = folders.find(f => f.name.toLowerCase().includes('tv') || f.name.toLowerCase().includes('show'));
  else if (isMovie) suggestion = folders.find(f => f.name.toLowerCase().includes('movie'));
  else if (isMusic) suggestion = folders.find(f => f.name.toLowerCase().includes('music') || f.name.toLowerCase().includes('audio'));

  return suggestion ? suggestion.id : null;
};
