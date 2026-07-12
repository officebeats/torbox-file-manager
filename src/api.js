export const fetchTorrents = async (apiKey) => {
  try {
    const response = await fetch('https://api.torbox.app/v1/api/torrents/mylist', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`TorBox API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching torrents:', error);
    throw error;
  }
};

export const controlTorrent = async (apiKey, torrentId, operation) => {
  try {
    const response = await fetch('https://api.torbox.app/v1/api/torrents/controltorrent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        torrent_id: torrentId,
        operation: operation
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`TorBox API control error: ${response.status} - ${errText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error performing ${operation} on torrent ${torrentId}:`, error);
    throw error;
  }
};

export const exportTorrentData = async (apiKey, torrentId, type = 'magnet') => {
  try {
    const response = await fetch(`https://api.torbox.app/v1/api/torrents/exportdata?torrent_id=${torrentId}&type=${type}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`TorBox API export error: ${response.status}`);
    }

    const data = await response.json();
    return data.data; // Usually returns the magnet link string or metadata details
  } catch (error) {
    console.error(`Error exporting ${type} for torrent ${torrentId}:`, error);
    throw error;
  }
};
