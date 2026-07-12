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
      setIsLoaded(true);
    }
  }, []);

  const saveVfs = (newVfs) => {
    setVfs(newVfs);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.set({ vfsData: newVfs }, () => {
        if (chrome.runtime.lastError) {
          console.warn("Storage sync failed, saving locally:", chrome.runtime.lastError.message);
          chrome.storage.local.set({ vfsData: newVfs });
        }
      });
    }
  };

  const importVfsData = (importedVfs) => {
    if (importedVfs && Array.isArray(importedVfs.folders) && Array.isArray(importedVfs.tags) && importedVfs.itemMappings) {
      saveVfs({
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
    saveVfs({ ...vfs, folders: [...vfs.folders, newFolder] });
  };

  const renameFolder = (folderId, newName) => {
    if (folderId === 'root') return;
    const newFolders = vfs.folders.map(f => f.id === folderId ? { ...f, name: newName } : f);
    saveVfs({ ...vfs, folders: newFolders });
  };

  const createTag = (name, color = '#ffffff') => {
    const newTag = { id: `tag_${Date.now()}`, name, color };
    saveVfs({ ...vfs, tags: [...vfs.tags, newTag] });
  };

  const moveItemToFolder = (itemId, folderId) => {
    const newMappings = { ...vfs.itemMappings };
    newMappings[itemId] = { 
      ...(newMappings[itemId] || { tags: [] }), 
      folderId,
      placedAt: Date.now() // Track when it was placed here
    };
    saveVfs({ ...vfs, itemMappings: newMappings });
  };

  const addTagToItem = (itemId, tagId) => {
    const newMappings = { ...vfs.itemMappings };
    const itemData = newMappings[itemId] || { folderId: 'root', tags: [] };
    if (!itemData.tags.includes(tagId)) {
      itemData.tags = [...itemData.tags, tagId];
    }
    newMappings[itemId] = itemData;
    saveVfs({ ...vfs, itemMappings: newMappings });
  };

  const removeTagFromItem = (itemId, tagId) => {
    const newMappings = { ...vfs.itemMappings };
    if (newMappings[itemId]) {
      newMappings[itemId].tags = newMappings[itemId].tags.filter(t => t !== tagId);
      saveVfs({ ...vfs, itemMappings: newMappings });
    }
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
    
    const newMappings = { ...vfs.itemMappings };
    Object.keys(newMappings).forEach(itemId => {
      if (newMappings[itemId]?.folderId === folderId) {
        newMappings[itemId].folderId = 'root';
        newMappings[itemId].placedAt = Date.now();
      }
    });

    const newFolders = vfs.folders.filter(f => f.id !== folderId);
    newFolders.forEach(f => {
      if (f.parentId === folderId) f.parentId = 'root';
    });

    saveVfs({ ...vfs, folders: newFolders, itemMappings: newMappings });
  };

  const createTagAndAddToItems = (name, color, itemIds) => {
    const tagId = `tag_${Date.now()}`;
    const newTag = { id: tagId, name, color };
    
    const newMappings = { ...vfs.itemMappings };
    itemIds.forEach(itemId => {
      const itemData = newMappings[itemId] || { folderId: 'root', tags: [] };
      if (!itemData.tags.includes(tagId)) {
        itemData.tags = [...itemData.tags, tagId];
      }
      newMappings[itemId] = itemData;
    });

    saveVfs({
      ...vfs,
      tags: [...vfs.tags, newTag],
      itemMappings: newMappings
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

    const newFolders = vfs.folders.map(f => {
      if (f.id === folderId) {
        return { ...f, parentId: targetParentId };
      }
      return f;
    });

    saveVfs({ ...vfs, folders: newFolders });
  };

  const moveItemsToFolders = (mappings) => {
    const newMappings = { ...vfs.itemMappings };
    Object.entries(mappings).forEach(([itemId, folderId]) => {
      const itemData = newMappings[itemId] || { folderId: 'root', tags: [] };
      newMappings[itemId] = {
        ...itemData,
        folderId,
        placedAt: Date.now()
      };
    });
    saveVfs({ ...vfs, itemMappings: newMappings });
  };

  const addTagToItems = (itemIds, tagId) => {
    const newMappings = { ...vfs.itemMappings };
    itemIds.forEach(itemId => {
      const itemData = newMappings[itemId] || { folderId: 'root', tags: [] };
      if (!itemData.tags.includes(tagId)) {
        itemData.tags = [...itemData.tags, tagId];
      }
      newMappings[itemId] = itemData;
    });
    saveVfs({ ...vfs, itemMappings: newMappings });
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
