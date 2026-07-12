import { useState, useEffect } from 'react';

// Default initial state
const initialState = {
  folders: [
    { id: 'root', name: 'Root', parentId: null },
    { id: 'movies', name: 'Movies', parentId: 'root' },
    { id: 'shows', name: 'TV Shows', parentId: 'root' },
  ],
  tags: [
    { id: 'tag_1', name: 'Important', color: '#ff4757' },
    { id: 'tag_2', name: 'Keep', color: '#1e90ff' },
    { id: 'tag_3', name: 'Watched', color: '#00d287' }
  ],
  itemMappings: {} // torboxItem.id -> { folderId, tags: [], placedAt: timestamp }
};

export function useVFS() {
  const [vfs, setVfs] = useState(initialState);
  const [isLoaded, setIsLoaded] = useState(false);

  // Sync VFS state from storage on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.get(['vfsData'], (syncResult) => {
        if (syncResult.vfsData) {
          setVfs({
            folders: syncResult.vfsData.folders || initialState.folders,
            tags: syncResult.vfsData.tags || initialState.tags,
            itemMappings: syncResult.vfsData.itemMappings || initialState.itemMappings
          });
          setIsLoaded(true);
        } else {
          chrome.storage.local.get(['vfsData'], (localResult) => {
            if (localResult.vfsData) {
              setVfs({
                folders: localResult.vfsData.folders || initialState.folders,
                tags: localResult.vfsData.tags || initialState.tags,
                itemMappings: localResult.vfsData.itemMappings || initialState.itemMappings
              });
            }
            setIsLoaded(true);
          });
        }
      });
    } else {
      let localData = null;
      try {
        localData = localStorage.getItem('vfsData');
      } catch (e) {
        console.warn('localStorage read failed:', e);
      }
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          setVfs({
            folders: parsed.folders || initialState.folders,
            tags: parsed.tags || initialState.tags,
            itemMappings: parsed.itemMappings || initialState.itemMappings
          });
        } catch (e) {
          console.error('Error parsing VFS localData:', e);
        }
      }
      setIsLoaded(true);
    }
  }, []);

  // Persist VFS state to storage whenever VFS state changes
  useEffect(() => {
    if (!isLoaded) return;
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.set({ vfsData: vfs }, () => {
        if (chrome.runtime.lastError) {
          console.warn("Storage sync failed, saving locally:", chrome.runtime.lastError.message);
          chrome.storage.local.set({ vfsData: vfs });
        }
      });
    } else {
      try {
        localStorage.setItem('vfsData', JSON.stringify(vfs));
      } catch (e) {
        console.warn('localStorage write failed:', e);
      }
    }
  }, [vfs, isLoaded]);

  const importVfsData = (importedVfs) => {
    if (importedVfs && Array.isArray(importedVfs.folders) && Array.isArray(importedVfs.tags) && importedVfs.itemMappings) {
      setVfs({
        folders: importedVfs.folders,
        tags: importedVfs.tags,
        itemMappings: importedVfs.itemMappings
      });
      return true;
    }
    return false;
  };

  const createFolder = (name, parentId = 'root') => {
    const newFolder = { id: `folder_${Date.now()}`, name, parentId };
    setVfs(prev => ({
      ...prev,
      folders: [...prev.folders, newFolder]
    }));
  };

  const renameFolder = (folderId, newName) => {
    if (folderId === 'root') return;
    setVfs(prev => ({
      ...prev,
      folders: prev.folders.map(f => f.id === folderId ? { ...f, name: newName } : f)
    }));
  };

  const createTag = (name, color = '#ffffff') => {
    const newTag = { id: `tag_${Date.now()}`, name, color };
    setVfs(prev => ({
      ...prev,
      tags: [...prev.tags, newTag]
    }));
  };

  const moveItemToFolder = (itemId, folderId) => {
    setVfs(prev => {
      const newMappings = { ...prev.itemMappings };
      newMappings[itemId] = { 
        ...(newMappings[itemId] || { tags: [] }), 
        folderId,
        placedAt: Date.now()
      };
      return { ...prev, itemMappings: newMappings };
    });
  };

  const addTagToItem = (itemId, tagId) => {
    setVfs(prev => {
      const itemData = prev.itemMappings[itemId] || { folderId: 'root', tags: [] };
      if (itemData.tags.includes(tagId)) return prev;
      return {
        ...prev,
        itemMappings: {
          ...prev.itemMappings,
          [itemId]: {
            ...itemData,
            tags: [...itemData.tags, tagId]
          }
        }
      };
    });
  };

  const removeTagFromItem = (itemId, tagId) => {
    setVfs(prev => {
      const itemData = prev.itemMappings[itemId];
      if (!itemData || !itemData.tags.includes(tagId)) return prev;
      return {
        ...prev,
        itemMappings: {
          ...prev.itemMappings,
          [itemId]: {
            ...itemData,
            tags: itemData.tags.filter(t => t !== tagId)
          }
        }
      };
    });
  };

  const getFolderContents = (folderId) => {
    return Object.keys(vfs.itemMappings).filter(itemId => {
      return (vfs.itemMappings[itemId]?.folderId || 'root') === folderId;
    });
  };
  
  const getTagContents = (tagId) => {
    return Object.keys(vfs.itemMappings).filter(itemId => {
      return vfs.itemMappings[itemId]?.tags?.includes(tagId);
    });
  };

  const getSubfolders = (folderId) => {
    return vfs.folders.filter(f => f.parentId === folderId);
  };

  const deleteFolder = (folderId) => {
    if (folderId === 'root') return;
    
    setVfs(prev => {
      const newMappings = { ...prev.itemMappings };
      Object.keys(newMappings).forEach(itemId => {
        if (newMappings[itemId]?.folderId === folderId) {
          newMappings[itemId] = { ...newMappings[itemId], folderId: 'root', placedAt: Date.now() };
        }
      });

      const newFolders = prev.folders.filter(f => f.id !== folderId).map(f => {
        if (f.parentId === folderId) {
          return { ...f, parentId: 'root' };
        }
        return f;
      });

      return { ...prev, folders: newFolders, itemMappings: newMappings };
    });
  };

  const createTagAndAddToItems = (name, color, itemIds) => {
    const tagId = `tag_${Date.now()}`;
    const newTag = { id: tagId, name, color };
    
    setVfs(prev => {
      const newMappings = { ...prev.itemMappings };
      itemIds.forEach(itemId => {
        const itemData = prev.itemMappings[itemId] || { folderId: 'root', tags: [] };
        newMappings[itemId] = {
          ...itemData,
          tags: itemData.tags.includes(tagId) ? itemData.tags : [...itemData.tags, tagId]
        };
      });
      return { ...prev, tags: [...prev.tags, newTag], itemMappings: newMappings };
    });
  };

  const moveFolderToFolder = (folderId, targetParentId) => {
    if (folderId === 'root' || folderId === targetParentId) return;
    
    let currentId = targetParentId;
    while (currentId && currentId !== 'root') {
      const f = vfs.folders.find(x => x.id === currentId);
      if (!f) break;
      if (f.id === folderId) {
        alert('Cannot move a folder inside itself or its own subfolders.');
        return;
      }
      currentId = f.parentId;
    }

    setVfs(prev => {
      const newFolders = prev.folders.map(f => {
        if (f.id === folderId) {
          return { ...f, parentId: targetParentId };
        }
        return f;
      });
      return { ...prev, folders: newFolders };
    });
  };

  const moveItemsToFolders = (mappings) => {
    setVfs(prev => {
      const newMappings = { ...prev.itemMappings };
      Object.entries(mappings).forEach(([itemId, folderId]) => {
        const itemData = prev.itemMappings[itemId] || { folderId: 'root', tags: [] };
        newMappings[itemId] = {
          ...itemData,
          folderId,
          placedAt: Date.now()
        };
      });
      return { ...prev, itemMappings: newMappings };
    });
  };

  const addTagToItems = (itemIds, tagId) => {
    setVfs(prev => {
      const newMappings = { ...prev.itemMappings };
      itemIds.forEach(itemId => {
        const itemData = prev.itemMappings[itemId] || { folderId: 'root', tags: [] };
        newMappings[itemId] = {
          ...itemData,
          tags: itemData.tags.includes(tagId) ? itemData.tags : [...itemData.tags, tagId]
        };
      });
      return { ...prev, itemMappings: newMappings };
    });
  };

  return {
    vfs,
    isLoaded,
    createFolder,
    renameFolder,
    createTag,
    createTagAndAddToItems,
    moveItemToFolder,
    moveFolderToFolder,
    moveItemsToFolders,
    addTagToItem,
    addTagToItems,
    removeTagFromItem,
    getFolderContents,
    getTagContents,
    getSubfolders,
    deleteFolder,
    importVfsData
  };
}
