export const suggestFolder = (torrentName, folders) => {
  if (!torrentName) return null;
  const name = torrentName.toLowerCase();
  
  // Advanced heuristics for different file types
  const isAnime = /\[(subsplease|horriblesubs|era-i|erai-raws|judas|pitchi|subs|dual-audio|multi-audio)\]/i.test(name) || name.includes('anime');
  const isTVShow = !isAnime && (/s\d\de\d\d/i.test(name) || /season\s*\d+/i.test(name) || /episode\s*\d+/i.test(name) || /show/i.test(name) || /hdtv/i.test(name) || /hevc/i.test(name));
  const isMovie = !isTVShow && !isAnime && (name.includes('1080p') || name.includes('2160p') || name.includes('720p') || name.includes('bluray') || name.includes('web-dl') || name.includes('webrip') || name.includes('dvdrip') || name.includes('yts') || name.includes('yify') || name.includes('x264') || name.includes('x265') || name.endsWith('.mp4') || name.endsWith('.mkv') || name.endsWith('.avi'));
  const isMusic = name.endsWith('.mp3') || name.endsWith('.flac') || name.endsWith('.m4a') || name.endsWith('.wav') || name.includes('discography') || name.includes('flac') || name.includes('album');
  const isBook = name.endsWith('.epub') || name.endsWith('.pdf') || name.endsWith('.mobi') || name.endsWith('.cbz') || name.endsWith('.cbr') || name.includes('ebook') || name.includes('novel');
  const isGame = name.endsWith('.iso') || name.endsWith('.exe') || name.endsWith('.dmg') || name.includes('repack') || name.includes('fitgirl') || name.includes('crack') || name.includes('steam') || name.includes('game');
  const isArchive = name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z') || name.endsWith('.tar.gz');

  let suggestion = null;

  const findFolder = (keywords) => {
    return folders.find(f => {
      const fname = f.name.toLowerCase();
      return keywords.some(kw => fname.includes(kw));
    });
  };

  if (isAnime) suggestion = findFolder(['anime', 'japan', 'animation']);
  if (!suggestion && isTVShow) suggestion = findFolder(['tv', 'show', 'series', 'season']);
  if (!suggestion && isMovie) suggestion = findFolder(['movie', 'film', 'cinema']);
  if (!suggestion && isMusic) suggestion = findFolder(['music', 'song', 'audio', 'soundtrack']);
  if (!suggestion && isBook) suggestion = findFolder(['book', 'read', 'epub', 'pdf', 'document']);
  if (!suggestion && isGame) suggestion = findFolder(['game', 'software', 'app', 'program', 'exe']);
  if (!suggestion && isArchive) suggestion = findFolder(['archive', 'zip', 'rar', 'download']);

  return suggestion ? suggestion.id : null;
};
