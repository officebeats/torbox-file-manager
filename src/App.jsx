import { useState, useEffect, useRef } from 'react'
import './App.css'
import { fetchTorrents } from './api'
import { useVFS } from './useVFS'
import { suggestFolder } from './utils'
const formatBytes = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateStr) => {
  try {
    if (!dateStr) return 'N/A'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return 'N/A'
    return d.toLocaleDateString()
  } catch {
    return 'N/A'
  }
}

const isVideo = (name) => {
  if (!name) return false
  const ext = name.split('.').pop().toLowerCase()
  return ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'm4v', 'ts', '3gp', 'wmv'].includes(ext)
}

function App() {
  const [activeTab, setActiveTab] = useState('all') // tab or folderId/tagId
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  
  const [torrents, setTorrents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Selection & Drag state
  const [selectedItems, setSelectedItems] = useState(new Set())
  const [lastSelected, setLastSelected] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOverFolder, setDragOverFolder] = useState(null)
  const [draggedTagId, setDraggedTagId] = useState(null)

  // Sort & Search state
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })
  const [searchQuery, setSearchQuery] = useState('')

  // Navigation History
  const [historyStack, setHistoryStack] = useState(['all'])
  const [historyIdx, setHistoryIdx] = useState(0)

  // Dropdown & Menu states
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [showTagMenu, setShowTagMenu] = useState(false)
  const [activeInlineMenu, setActiveInlineMenu] = useState(null) // itemId for inline move
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, target: null })
  
  const ghostRef = useRef(null)

  const { 
    vfs, 
    isLoaded: vfsLoaded, 
    createFolder, 
    renameFolder,
    createTag, 
    createTagAndAddToItems,
    moveItemToFolder, 
    moveFolderToFolder,
    moveItemsToFolders,
    addTagToItem, 
    addTagToItems,
    getTagContents, 
    getSubfolders, 
    deleteFolder,
    importVfsData
  } = useVFS()

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.get(['torboxApiKey'], (syncRes) => {
        if (syncRes.torboxApiKey) {
          setApiKey(syncRes.torboxApiKey)
          setHasKey(true)
        } else {
          chrome.storage.local.get(['torboxApiKey'], (localRes) => {
            if (localRes.torboxApiKey) {
              setApiKey(localRes.torboxApiKey)
              setHasKey(true)
            }
          })
        }
      })
    } else {
      try {
        const localKey = localStorage.getItem('torboxApiKey')
        if (localKey) {
          setApiKey(localKey)
          setHasKey(true)
        }
      } catch (e) {
        console.warn('localStorage read failed:', e)
      }
    }
  }, [])

  useEffect(() => {
    if (hasKey && apiKey) loadTorrents()
  }, [hasKey, apiKey])

  const loadTorrents = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTorrents(apiKey)
      setTorrents(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Safe navigation
  const navigateTo = (tab) => {
    if (activeTab === tab) return
    const newStack = historyStack.slice(0, historyIdx + 1)
    newStack.push(tab)
    setHistoryStack(newStack)
    setHistoryIdx(newStack.length - 1)
    setActiveTab(tab)
    clearSelections()
  }

  const goBack = () => {
    if (historyIdx > 0) {
      const newIdx = historyIdx - 1
      setHistoryIdx(newIdx)
      setActiveTab(historyStack[newIdx])
      clearSelections()
    }
  }

  const goForward = () => {
    if (historyIdx < historyStack.length - 1) {
      const newIdx = historyIdx + 1
      setHistoryIdx(newIdx)
      setActiveTab(historyStack[newIdx])
      clearSelections()
    }
  }

  const clearSelections = () => {
    setSelectedItems(new Set())
    setLastSelected(null)
    setShowMoveMenu(false)
    setShowTagMenu(false)
    setActiveInlineMenu(null)
    setContextMenu({ visible: false, x: 0, y: 0, target: null })
  }

  const saveApiKey = (e) => {
    e.preventDefault()
    if (!apiKey.trim()) return
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.set({ torboxApiKey: apiKey.trim() }, () => {
        chrome.storage.local.set({ torboxApiKey: apiKey.trim() }, () => {
          setHasKey(true)
          alert('API Key saved successfully!')
          window.location.reload()
        })
      })
    } else {
      try {
        localStorage.setItem('torboxApiKey', apiKey.trim())
      } catch (e) {
        console.warn('localStorage write failed:', e)
      }
      setHasKey(true)
    }
  }

  const handleExportConfig = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(vfs));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href",     dataStr);
    downloadAnchor.setAttribute("download", `torbox-vfs-backup-${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  const handleImportConfig = (e) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (importVfsData(parsed)) {
            alert('VFS backup imported successfully!');
            window.location.reload();
          } else {
            alert('Invalid backup file structure.');
          }
        } catch (err) {
          alert('Failed to parse backup file: ' + err.message);
        }
      };
    }
  }

  // --- SELECTION LOGIC ---
  const handleItemClick = (e, id, index, displayedList) => {
    e.stopPropagation()
    setActiveInlineMenu(null)
    if (e.target.tagName.toLowerCase() === 'input' && e.target.type === 'checkbox') return
    if (e.target.closest('.inline-actions')) return

    const newSelection = new Set(selectedItems)
    
    if (e.shiftKey && lastSelected !== null) {
      const start = Math.min(lastSelected, index)
      const end = Math.max(lastSelected, index)
      for (let i = start; i <= end; i++) {
        if (displayedList[i].type !== 'folder') {
          newSelection.add(displayedList[i].id)
        }
      }
    } else if (e.ctrlKey || e.metaKey) {
      if (newSelection.has(id)) newSelection.delete(id)
      else newSelection.add(id)
      setLastSelected(index)
    } else {
      newSelection.clear()
      newSelection.add(id)
      setLastSelected(index)
    }
    
    setSelectedItems(newSelection)
  }

  const handleCheckboxClick = (e, id) => {
    e.stopPropagation()
    const newSelection = new Set(selectedItems)
    if (newSelection.has(id)) newSelection.delete(id)
    else newSelection.add(id)
    setSelectedItems(newSelection)
  }

  const handleSelectAll = (displayedList) => {
    const files = displayedList.filter(item => item.type !== 'folder')
    if (selectedItems.size === files.length && files.length > 0) {
      setSelectedItems(new Set())
    } else {
      const newSelection = new Set()
      files.forEach(t => newSelection.add(t.id))
      setSelectedItems(newSelection)
    }
  }

  const handleDoubleClickFolder = (folderId) => {
    navigateTo(folderId)
  }

  const handleDoubleClickFile = (item) => {
    if (item.type === 'subfile') {
      window.open(`https://api.torbox.app/v1/api/torrents/requestdl?token=${apiKey}&torrent_id=${item.torrentId}&file_id=${item.fileId}&redirect=true`, '_blank')
    } else if (item.files && item.files.length > 1) {
      navigateTo(`torrent_${item.id}`)
    } else {
      window.open(`https://api.torbox.app/v1/api/torrents/requestdl?token=${apiKey}&torrent_id=${item.id}&file_id=0&redirect=true`, '_blank')
    }
  }

  const handleFolderDragStart = (e, folder) => {
    setIsDragging(true)
    const payload = { type: 'folder', id: folder.id }
    e.dataTransfer.setData('application/json', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
  }

  // --- CONTEXT MENU LOGIC ---
  const handleItemContextMenu = (e, item) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      target: item
    })
  }

  // --- DRAG AND DROP (FILES) ---
  const handleDragStart = (e, torrent) => {
    let currentSelection = new Set(selectedItems)
    if (!currentSelection.has(torrent.id)) {
      currentSelection = new Set([torrent.id])
      setSelectedItems(currentSelection)
    }
    
    setIsDragging(true)
    const payload = { type: 'files', ids: Array.from(currentSelection) }
    e.dataTransfer.setData('application/json', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
    
    if (currentSelection.size > 1 && ghostRef.current) {
      ghostRef.current.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
        Moving ${currentSelection.size} items
      `
      e.dataTransfer.setDragImage(ghostRef.current, -10, -10)
    }
  }

  const handleTagDragStart = (e, tag) => {
    setDraggedTagId(tag.id)
    const payload = { type: 'tag', tagId: tag.id }
    e.dataTransfer.setData('application/json', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    setDragOverFolder(null)
    setDraggedTagId(null)
  }

  const handleDragOverFolder = (e, folderId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverFolder !== folderId) setDragOverFolder(folderId)
  }

  const handleDragOverFile = (e) => {
    if (draggedTagId) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }

  const handleDragLeave = (e, folderId) => {
    e.preventDefault()
    if (dragOverFolder === folderId) setDragOverFolder(null)
  }

  const handleDropOnFolder = (e, folderId) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverFolder(null)
    setIsDragging(false)
    
    try {
      const payload = JSON.parse(e.dataTransfer.getData('application/json'))
      if (payload.type === 'files' && Array.isArray(payload.ids)) {
        const mappings = {}
        payload.ids.forEach(id => { mappings[id] = folderId })
        moveItemsToFolders(mappings)
        setSelectedItems(new Set())
      } else if (payload.type === 'folder') {
        moveFolderToFolder(payload.id, folderId)
      }
    } catch (err) {
      console.error("Failed to parse drop payload", err)
    }
  }

  const handleDropOnFile = (e, targetFileId) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggedTagId(null)

    try {
      const payload = JSON.parse(e.dataTransfer.getData('application/json'))
      if (payload.type === 'tag') {
        if (selectedItems.has(targetFileId)) {
          selectedItems.forEach(id => addTagToItem(id, payload.tagId))
          setSelectedItems(new Set())
        } else {
          addTagToItem(targetFileId, payload.tagId)
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleNewFolder = () => {
    const name = prompt('Enter folder name:')
    if (name && name.trim()) createFolder(name.trim(), activeTab === 'all' || activeTab === 'recent' ? 'root' : activeTab)
  }

  const handleNewTag = () => {
    const name = prompt('Enter tag name:')
    if (name && name.trim()) {
      const color = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
      createTag(name.trim(), color)
    }
  }

  const handleRenameFolder = (folderId) => {
    const name = prompt('Enter new folder name:')
    if (name && name.trim()) renameFolder(folderId, name.trim())
  }

  // --- BATCH & INLINE ACTIONS ---
  const batchMove = (folderId) => {
    const mappings = {}
    selectedItems.forEach(id => { mappings[id] = folderId })
    moveItemsToFolders(mappings)
    clearSelections()
  }

  const batchAddTag = (tagId) => {
    addTagToItems(Array.from(selectedItems), tagId)
    clearSelections()
  }

  const batchAutoOrganize = () => {
    const mappings = {}
    selectedItems.forEach(id => {
      const file = torrents.find(t => t.id === id)
      if (file) {
        const suggestion = suggestFolder(file.name, vfs.folders.filter(f => f.id !== 'root'))
        if (suggestion) {
          mappings[id] = suggestion.id || suggestion
        }
      }
    })
    moveItemsToFolders(mappings)
    clearSelections()
  }

  // --- PREPARE DISPLAY ITEMS ---
  let displayedItems = []
  
  if (activeTab === 'recent') {
    const sortedTorrents = [...torrents].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 20)
    displayedItems = sortedTorrents.map(t => ({ ...t, type: 'file' }))
  } 
  else if (activeTab === 'settings') {
    // Handled in render
  } 
  else if (activeTab.startsWith('tag_')) {
    const tagContents = getTagContents(activeTab)
    const taggedFiles = []
    tagContents.forEach(itemId => {
      const itemIdStr = itemId.toString()
      if (itemIdStr.includes('_file_')) {
        const [tId, fId] = itemIdStr.split('_file_')
        const torrent = torrents.find(t => t.id.toString() === tId)
        if (torrent && torrent.files) {
          const file = torrent.files.find(f => f.id.toString() === fId)
          if (file) {
            taggedFiles.push({
              id: itemIdStr,
              torrentId: torrent.id,
              fileId: file.id,
              name: file.name,
              size: file.size,
              created_at: torrent.created_at,
              download_state: torrent.download_state,
              type: 'subfile'
            })
          }
        }
      } else {
        const torrent = torrents.find(t => t.id.toString() === itemIdStr || t.id === parseInt(itemIdStr))
        if (torrent) {
          taggedFiles.push({ ...torrent, type: 'file' })
        }
      }
    })
    displayedItems = taggedFiles
  }
  else if (activeTab.startsWith('torrent_')) {
    const torrentId = activeTab.split('_')[1]
    const torrent = torrents.find(t => t.id.toString() === torrentId || t.id === parseInt(torrentId))
    if (torrent && torrent.files) {
      displayedItems = torrent.files.map(file => ({
        id: `${torrent.id}_file_${file.id}`,
        torrentId: torrent.id,
        fileId: file.id,
        name: file.name,
        size: file.size,
        created_at: torrent.created_at,
        download_state: torrent.download_state,
        type: 'subfile'
      }))
    }
  }
  else {
    const targetFolderId = activeTab === 'all' ? 'root' : activeTab
    const childFolders = getSubfolders(targetFolderId)
    
    let folderTorrents = []
    if (targetFolderId === 'root') {
      folderTorrents = torrents.filter(t => {
        const mapping = vfs.itemMappings[t.id.toString()] || vfs.itemMappings[t.id]
        return !mapping || !mapping.folderId || mapping.folderId === 'root'
      })
    } else {
      folderTorrents = torrents.filter(t => {
        const mapping = vfs.itemMappings[t.id.toString()] || vfs.itemMappings[t.id]
        return mapping && mapping.folderId === targetFolderId
      })
    }
    
    displayedItems = [
      ...childFolders.map(f => ({ ...f, type: 'folder' })),
      ...folderTorrents.map(t => ({ ...t, type: 'file' }))
    ]
  }

  // Apply Live Search
  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase()
    displayedItems = displayedItems.filter(item => item.name.toLowerCase().includes(q))
  }

  // Sorting
  if (activeTab !== 'recent' && activeTab !== 'settings') {
    const folders = displayedItems.filter(i => i.type === 'folder').sort((a, b) => a.name.localeCompare(b.name))
    const files = displayedItems.filter(i => i.type === 'file' || i.type === 'subfile').sort((a, b) => {
      let valA, valB
      switch(sortConfig.key) {
        case 'name':
          valA = a.name.toLowerCase()
          valB = b.name.toLowerCase()
          break
        case 'date':
          valA = new Date(a.created_at || 0).getTime()
          valB = new Date(b.created_at || 0).getTime()
          break
        case 'placed':
          // Sort by placement date
          valA = vfs.itemMappings[a.id]?.placedAt || 0
          valB = vfs.itemMappings[b.id]?.placedAt || 0
          break
        case 'size':
          valA = a.size || 0
          valB = b.size || 0
          break
        case 'type':
          valA = (a.name.split('.').pop() || '').toLowerCase()
          valB = (b.name.split('.').pop() || '').toLowerCase()
          break
        default:
          valA = 0; valB = 0;
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
    displayedItems = [...folders, ...files]
  }

  // --- BREADCRUMBS BUILDER ---
  const renderBreadcrumbs = () => {
    if (activeTab === 'recent') return <span className="breadcrumb">Recent Downloads</span>
    if (activeTab === 'settings') return <span className="breadcrumb">Settings</span>
    if (activeTab.startsWith('tag_')) {
      const tg = vfs.tags.find(t => t.id === activeTab)
      return (
        <span className="breadcrumb">
          <span className="breadcrumb-link" onClick={() => navigateTo('all')}>Root</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-link">Tags</span>
          <span className="breadcrumb-separator">/</span>
          <span>{tg ? tg.name : 'Tag'}</span>
        </span>
      )
    }

    // Folders breadcrumb trail
    let torrentName = ''
    let parentFolderId = 'root'
    if (activeTab.startsWith('torrent_')) {
      const torrentId = activeTab.split('_')[1]
      const torrent = torrents.find(t => t.id.toString() === torrentId || t.id === parseInt(torrentId))
      if (torrent) {
        torrentName = torrent.name
        const mapping = vfs.itemMappings[torrent.id.toString()] || vfs.itemMappings[torrent.id]
        if (mapping && mapping.folderId) {
          parentFolderId = mapping.folderId
        }
      }
    }

    const path = []
    let currentId = activeTab.startsWith('torrent_') ? parentFolderId : (activeTab === 'all' ? 'root' : activeTab)
    
    while (currentId && currentId !== 'root') {
      const folder = vfs.folders.find(f => f.id === currentId)
      if (folder) {
        path.unshift(folder)
        currentId = folder.parentId
      } else {
        break
      }
    }

    return (
      <span className="breadcrumb">
        <span className="breadcrumb-link" onClick={() => navigateTo('all')}>Root</span>
        {path.map((folder) => (
          <span key={folder.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-link" onClick={() => navigateTo(folder.id)}>
              {folder.name}
            </span>
          </span>
        ))}
        {torrentName && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span className="breadcrumb-separator">/</span>
            <span>{torrentName}</span>
          </span>
        )}
      </span>
    )
  }

  // Directory Stats Summary
  const foldersCount = displayedItems.filter(i => i.type === 'folder').length
  const filesCount = displayedItems.filter(i => i.type === 'file' || i.type === 'subfile').length
  const totalSize = displayedItems.filter(i => i.type === 'file' || i.type === 'subfile').reduce((acc, f) => acc + (f.size || 0), 0)

  const displayedFiles = displayedItems.filter(i => i.type === 'file' || i.type === 'subfile')
  const allSelected = displayedFiles.length > 0 && selectedItems.size === displayedFiles.length
  const someSelected = selectedItems.size > 0 && selectedItems.size < displayedFiles.length

  return (
    <div className="app-container" onClick={clearSelections}>
      <div id="drag-ghost" ref={ghostRef}></div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div 
          className="context-menu" 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.target.type === 'file' ? (
            <>
              <div className="context-menu-item" onClick={() => { window.open('https://torbox.app/dashboard', '_blank'); clearSelections(); }}>
                🌐 Open in TorBox
              </div>
              <div className="context-menu-separator"></div>
              <div style={{ padding: '4px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Move To</div>
              <div className="context-menu-item" onClick={() => { moveItemToFolder(contextMenu.target.id, 'root'); clearSelections(); }}>
                📁 Root Directory
              </div>
              {vfs.folders.filter(f => f.id !== 'root').map(f => (
                <div key={f.id} className="context-menu-item" onClick={() => { moveItemToFolder(contextMenu.target.id, f.id); clearSelections(); }}>
                  📁 {f.name}
                </div>
              ))}
              <div className="context-menu-separator"></div>
              <div style={{ padding: '4px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tag with</div>
              {vfs.tags.map(t => (
                <div key={t.id} className="context-menu-item" onClick={() => { addTagToItem(contextMenu.target.id, t.id); clearSelections(); }}>
                  🏷️ {t.name}
                </div>
              ))}
              <div 
                className="context-menu-item" 
                style={{ borderTop: '1px solid var(--border-color)', fontWeight: 600 }}
                onClick={() => {
                  const name = prompt('Enter new tag name:')
                  if (name && name.trim()) {
                    const color = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
                    createTagAndAddToItems(name.trim(), color, [contextMenu.target.id])
                  }
                  clearSelections()
                }}
              >
                🏷️ + Create Tag...
              </div>
            </>
          ) : (
            <>
              <div className="context-menu-item" onClick={() => { handleRenameFolder(contextMenu.target.id); clearSelections(); }}>
                ✏️ Rename Folder
              </div>
              <div className="context-menu-separator"></div>
              <div style={{ padding: '4px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Move Folder To</div>
              <div className="context-menu-item" onClick={() => { moveFolderToFolder(contextMenu.target.id, 'root'); clearSelections(); }}>
                📁 Root Directory
              </div>
              {vfs.folders.filter(f => f.id !== 'root' && f.id !== contextMenu.target.id).map(f => (
                <div key={f.id} className="context-menu-item" onClick={() => { moveFolderToFolder(contextMenu.target.id, f.id); clearSelections(); }}>
                  📁 {f.name}
                </div>
              ))}
              <div className="context-menu-separator"></div>
              <div className="context-menu-item" style={{ color: 'var(--danger-color)' }} onClick={() => { deleteFolder(contextMenu.target.id); clearSelections(); }}>
                ✕ Delete Folder
              </div>
            </>
          )}
        </div>
      )}

      {/* Sidebar */}
      <aside className="sidebar" onClick={e => e.stopPropagation()}>
        <div className="sidebar-header">
          <div className="sidebar-logo">T</div>
          <h1>TorBox Manager</h1>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Views</div>
          <div 
            className={`nav-item ${activeTab === 'recent' ? 'active' : ''} ${dragOverFolder === 'root' ? 'drag-over' : ''}`}
            onClick={() => navigateTo('recent')}
            onDragOver={(e) => handleDragOverFolder(e, 'root')}
            onDragLeave={(e) => handleDragLeave(e, 'root')}
            onDrop={(e) => handleDropOnFolder(e, 'root')}
          >
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Recent
          </div>
          <div 
            className={`nav-item ${activeTab === 'all' ? 'active' : ''} ${dragOverFolder === 'root' ? 'drag-over' : ''}`}
            onClick={() => navigateTo('all')}
            onDragOver={(e) => handleDragOverFolder(e, 'root')}
            onDragLeave={(e) => handleDragLeave(e, 'root')}
            onDrop={(e) => handleDropOnFolder(e, 'root')}
          >
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            All Downloads (Root)
          </div>
        </div>

        {/* Tags Section */}
        <div className="sidebar-section" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div className="sidebar-section-title" style={{ margin: 0 }}>Tags</div>
            <button className="btn" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={handleNewTag}>+ New</button>
          </div>
          {vfsLoaded && vfs.tags.map(tag => (
            <div 
              key={tag.id}
              className={`nav-item tag-sidebar-item ${activeTab === tag.id ? 'active' : ''}`}
              onClick={() => navigateTo(tag.id)}
              draggable
              onDragStart={(e) => handleTagDragStart(e, tag)}
              onDragEnd={handleDragEnd}
              title="Drag onto any file in the list to tag it!"
            >
              <svg className="nav-icon" style={{ color: tag.color }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
              <span>{tag.name}</span>
            </div>
          ))}
        </div>

        {/* Folders Section */}
        <div className="sidebar-section" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div className="sidebar-section-title" style={{ margin: 0 }}>Folders</div>
            <button className="btn" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={handleNewFolder}>+ New</button>
          </div>
          {vfsLoaded && vfs.folders.filter(f => f.parentId === 'root' && f.id !== 'root').map(folder => (
            <div 
              key={folder.id}
              className={`nav-item ${activeTab === folder.id ? 'active' : ''} ${dragOverFolder === folder.id ? 'drag-over' : ''}`}
              onClick={() => navigateTo(folder.id)}
              onDragOver={(e) => handleDragOverFolder(e, folder.id)}
              onDragLeave={(e) => handleDragLeave(e, folder.id)}
              onDrop={(e) => handleDropOnFolder(e, folder.id)}
            >
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
              {activeTab === folder.id && (
                <span 
                  onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); navigateTo('recent'); }}
                  style={{ fontSize: '10px', opacity: 0.5, cursor: 'pointer' }}
                >
                  ✕
                </span>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', padding: '20px' }}>
          <div 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => navigateTo('settings')}
          >
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            Settings
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content" onClick={clearSelections}>
        <header className="topbar">
          <div className="breadcrumb-container">
            <div className="history-buttons">
              <button 
                className="history-btn" 
                onClick={goBack} 
                disabled={historyIdx === 0}
                title="Back"
              >
                ←
              </button>
              <button 
                className="history-btn" 
                onClick={goForward} 
                disabled={historyIdx === historyStack.length - 1}
                title="Forward"
              >
                →
              </button>
            </div>
            {renderBreadcrumbs()}
          </div>
          
          <div className="topbar-actions">
            {/* Search Bar */}
            {activeTab !== 'settings' && (
              <div className="search-container">
                <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Search file explorer..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            {/* Batch Action Bar */}
            {selectedItems.size > 0 && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(0, 210, 135, 0.1)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(0, 210, 135, 0.3)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 600, marginRight: '8px' }}>
                  {selectedItems.size} selected
                </span>
                
                <button className="btn" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); batchAutoOrganize(); }}>
                  ✨ Auto-Organize
                </button>

                <div className="dropdown">
                  <button className="btn" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); setShowTagMenu(false); }}>
                    Move To ▾
                  </button>
                  {showMoveMenu && (
                    <div className="dropdown-menu">
                      <div className="dropdown-item" onClick={() => batchMove('root')}>Root</div>
                      {vfs.folders.filter(f => f.id !== 'root').map(f => (
                        <div key={f.id} className="dropdown-item" onClick={() => batchMove(f.id)}>{f.name}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="dropdown">
                  <button className="btn" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); setShowTagMenu(!showTagMenu); setShowMoveMenu(false); }}>
                    Add Tag ▾
                  </button>
                  {showTagMenu && (
                    <div className="dropdown-menu">
                      {vfs.tags.map(t => (
                        <div key={t.id} className="dropdown-item" onClick={() => batchAddTag(t.id)}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color }}></span> {t.name}
                        </div>
                      ))}
                      <div 
                        className="dropdown-item" 
                        style={{ borderTop: '1px solid var(--border-color)', fontWeight: 600 }}
                        onClick={() => {
                          const name = prompt('Enter new tag name:')
                          if (name && name.trim()) {
                            const color = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
                            createTagAndAddToItems(name.trim(), color, Array.from(selectedItems))
                          }
                          clearSelections()
                        }}
                      >
                        + Create Tag...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sorting Controls */}
            {activeTab !== 'settings' && activeTab !== 'recent' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sort:</span>
                <select 
                  className="sort-select" 
                  value={sortConfig.key} 
                  onChange={(e) => handleSortChange(e.target.value)}
                >
                  <option value="date">Date Added</option>
                  <option value="placed">Date Organized</option>
                  <option value="name">Name</option>
                  <option value="size">Size</option>
                  <option value="type">File Type</option>
                </select>
                <button 
                  className="btn" 
                  style={{ padding: '6px' }}
                  onClick={() => setSortConfig({ ...sortConfig, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                >
                  {sortConfig.direction === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            )}
            
            {hasKey && (
              <button className="btn" onClick={loadTorrents} disabled={loading}>
                {loading ? '...' : 'Refresh'}
              </button>
            )}
          </div>
        </header>

        {/* List Controls / Summary */}
        {hasKey && activeTab !== 'settings' && (
          <div className="list-controls">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {displayedFiles.length > 0 && (
                <label className="custom-checkbox">
                  <input 
                    type="checkbox" 
                    checked={allSelected} 
                    ref={input => { if (input) input.indeterminate = someSelected; }}
                    onChange={() => handleSelectAll(displayedItems)}
                  />
                  <span className="checkmark"></span>
                </label>
              )}
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {foldersCount > 0 ? `${foldersCount} folder(s), ` : ''}
                {filesCount > 0 ? `${filesCount} file(s)` : 'No files'} 
                {filesCount > 0 ? ` (${formatBytes(totalSize)} total)` : ''}
              </span>
            </div>
            {activeTab !== 'recent' && (
              <button className="btn" style={{ padding: '2px 8px', fontSize: '0.8rem' }} onClick={handleNewFolder}>
                + New Folder
              </button>
            )}
          </div>
        )}

        <div className="file-view">
          {!hasKey && activeTab !== 'settings' ? (
            <div className="empty-state">
              <h3>API Key Required</h3>
              <p>Please enter your TorBox API key in settings to connect your account.</p>
              <button className="btn btn-primary" style={{marginTop: 16}} onClick={(e) => { e.stopPropagation(); navigateTo('settings'); }}>
                Go to Settings
              </button>
            </div>
          ) : activeTab === 'settings' ? (
            <div style={{ maxWidth: '600px' }}>
              <h2 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>Configuration</h2>
              <form onSubmit={saveApiKey}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                    TorBox API Key
                  </label>
                  <input 
                    type="password" 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Bearer token from TorBox dashboard"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--border-color)',
                      color: 'white',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
                <button type="submit" className="btn btn-primary">Save Settings</button>
              </form>

              <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)', fontSize: '1.1rem' }}>Backup & Cross-Device Sync</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4' }}>
                  Your configurations (folders, tags, and mappings) automatically sync across devices via your browser sign-in profile for free. You can also manually download a backup file to move your setup between different browsers (e.g. from Chrome to Opera).
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    onClick={handleExportConfig} 
                    className="btn" 
                    style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'var(--border-color)' }}
                  >
                    📥 Export Backup
                  </button>
                  <label 
                    className="btn" 
                    style={{ 
                      background: 'rgba(255,255,255,0.05)', 
                      borderColor: 'var(--border-color)', 
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                  >
                    📤 Import Backup
                    <input 
                      type="file" 
                      accept=".json" 
                      onChange={handleImportConfig} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="empty-state">
              <h3 style={{ color: 'var(--danger-color)' }}>Error Loading Torrents</h3>
              <p>{error}</p>
              <button className="btn" style={{marginTop: 16}} onClick={(e) => { e.stopPropagation(); loadTorrents(); }}>Try Again</button>
            </div>
          ) : loading && torrents.length === 0 ? (
            <div className="empty-state">
              <h3>Loading your files...</h3>
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="empty-state">
              <h3>No items found</h3>
              <p>This directory is empty.</p>
            </div>
          ) : (
            <div className="file-grid" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {displayedItems.map((item, index) => {
                if (item.type === 'folder') {
                  return (
                    <div 
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleFolderDragStart(e, item)}
                      onDragEnd={handleDragEnd}
                      onDoubleClick={() => handleDoubleClickFolder(item.id)}
                      onContextMenu={(e) => handleItemContextMenu(e, item)}
                      onDragOver={(e) => handleDragOverFolder(e, item.id)}
                      onDragLeave={(e) => handleDragLeave(e, item.id)}
                      onDrop={(e) => handleDropOnFolder(e, item.id)}
                      className={`folder-item ${dragOverFolder === item.id ? 'drag-over' : ''} ${activeInlineMenu === item.id ? 'active-menu-row' : ''}`}
                    >
                      <svg style={{ color: 'var(--accent-color)', marginRight: '16px', flexShrink: 0 }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                      <div style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>
                        {item.name}
                      </div>

                      {/* Inline Actions on Hover */}
                      <div className={`inline-actions ${activeInlineMenu === item.id ? 'active' : ''}`} onClick={e => e.stopPropagation()}>
                        <div className="dropdown">
                          <button 
                            className="btn" 
                            style={{ padding: '2px 8px', fontSize: '0.75rem' }} 
                            onClick={() => setActiveInlineMenu(activeInlineMenu === item.id ? null : item.id)}
                          >
                            Move To ▾
                          </button>
                          {activeInlineMenu === item.id && (
                            <div className="dropdown-menu">
                              <div className="dropdown-item" onClick={() => { moveFolderToFolder(item.id, 'root'); setActiveInlineMenu(null); }}>Root</div>
                              {vfs.folders.filter(f => f.id !== 'root' && f.id !== item.id).map(f => (
                                <div key={f.id} className="dropdown-item" onClick={() => { moveFolderToFolder(item.id, f.id); setActiveInlineMenu(null); }}>
                                  {f.name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <button className="btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => handleRenameFolder(item.id)}>
                          Rename
                        </button>
                        <button className="btn" style={{ padding: '2px 8px', fontSize: '0.75rem', borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }} onClick={() => deleteFolder(item.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                }

                // Render File
                const isSelected = selectedItems.has(item.id)
                const draggingClass = (isDragging && isSelected) ? 'dragging' : ''
                const selectedClass = isSelected ? 'selected' : ''
                const itemTags = vfs.itemMappings[item.id]?.tags || []
                const isCompleted = ['completed', 'cached', 'seeding'].includes(item.download_state)
                
                // Smart Suggestions
                let suggestion = null
                if (item.type === 'file' && ['recent', 'all'].includes(activeTab)) {
                  const sId = suggestFolder(item.name, vfs.folders.filter(f => f.id !== 'root'))
                  if (sId) {
                    suggestion = vfs.folders.find(f => f.id === sId)
                  }
                }

                // Context-aware properties
                const isMultiFile = item.type === 'file' && item.files && item.files.length > 1
                const showPlay = (item.type === 'subfile' || !isMultiFile) && isVideo(item.name)
                const showZip = (item.type === 'file' && isMultiFile)
                const parentTorrentId = item.type === 'subfile' ? item.torrentId : item.id
                const fileId = item.type === 'subfile' ? item.fileId : 0

                return (
                  <div 
                    key={item.id}
                    draggable={item.type === 'file'}
                    onDragStart={(e) => handleDragStart(e, item)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOverFile}
                    onDrop={(e) => handleDropOnFile(e, item.id)}
                    onContextMenu={(e) => handleItemContextMenu(e, item)}
                    onClick={(e) => handleItemClick(e, item.id, index, displayedItems)}
                    onDoubleClick={() => handleDoubleClickFile(item)}
                    className={`file-item ${selectedClass} ${draggingClass} ${activeInlineMenu === item.id ? 'active-menu-row' : ''}`}
                  >
                    <label className="custom-checkbox" style={{ marginRight: '16px' }} onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={(e) => handleCheckboxClick(e, item.id)}
                      />
                      <span className="checkmark"></span>
                    </label>

                    {isMultiFile ? (
                      <svg style={{ opacity: isSelected ? 1 : 0.5, color: isSelected ? 'var(--accent-color)' : 'currentColor', marginRight: '16px', flexShrink: 0 }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        <line x1="8" y1="12" x2="16" y2="12" strokeWidth="1.5" stroke="currentColor" />
                        <line x1="8" y1="15" x2="14" y2="15" strokeWidth="1.5" stroke="currentColor" />
                      </svg>
                    ) : (
                      <svg style={{ opacity: isSelected ? 1 : 0.5, color: isSelected ? 'var(--accent-color)' : 'currentColor', marginRight: '16px', flexShrink: 0 }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '6px' }}>
                        {item.name}
                      </div>
                      <div className="file-meta" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span>{formatBytes(item.size)}</span>
                        {isMultiFile && (
                          <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>({item.files.length} files)</span>
                        )}
                        <span>Added: {formatDate(item.created_at)}</span>
                        {item.type === 'file' && vfs.itemMappings[item.id]?.placedAt && (
                          <span style={{ color: 'var(--text-secondary)' }}>
                            Organized: {formatDate(vfs.itemMappings[item.id]?.placedAt)}
                          </span>
                        )}
                        <span style={{ color: 'var(--accent-color)' }}>{item.download_state}</span>
                        
                        {/* Tags Badges */}
                        {item.type === 'file' && itemTags.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                            {itemTags.map(tid => {
                              const tg = vfs.tags.find(t => t.id === tid)
                              if (!tg) return null
                              return (
                                <span key={tid} className="tag-badge" style={{ color: tg.color, borderColor: tg.color, background: `${tg.color}20` }}>
                                  {tg.name}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Inline Hover Actions for Easy Moving & TorBox Tools */}
                    <div className={`inline-actions ${activeInlineMenu === item.id ? 'active' : ''}`} onClick={e => e.stopPropagation()}>
                      {item.type === 'file' && suggestion && (
                        <button 
                          className="btn"
                          style={{ fontSize: '0.75rem', padding: '4px 8px', borderColor: 'rgba(0, 210, 135, 0.3)', color: 'var(--accent-color)' }}
                          onClick={() => moveItemToFolder(item.id, suggestion.id)}
                          title={`Auto-move to ${suggestion.name}`}
                        >
                          ✨ Suggest: {suggestion.name}
                        </button>
                      )}

                      {item.type === 'file' && (
                        <div className="dropdown">
                          <button 
                            className="btn" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }} 
                            onClick={() => setActiveInlineMenu(activeInlineMenu === item.id ? null : item.id)}
                          >
                            Move To ▾
                          </button>
                          {activeInlineMenu === item.id && (
                            <div className="dropdown-menu">
                              <div className="dropdown-item" onClick={() => { moveItemToFolder(item.id, 'root'); setActiveInlineMenu(null); }}>Root</div>
                              {vfs.folders.filter(f => f.id !== 'root').map(f => (
                                <div key={f.id} className="dropdown-item" onClick={() => { moveItemToFolder(item.id, f.id); setActiveInlineMenu(null); }}>
                                  {f.name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* TorBox Contextual File Options */}
                      <div style={{ display: 'flex', gap: '4px', marginLeft: '8px', alignItems: 'center' }}>
                        {showPlay && (
                          <button 
                            className="action-btn"
                            title="Stream Video"
                            disabled={!isCompleted}
                            style={{ opacity: isCompleted ? 1 : 0.3, cursor: isCompleted ? 'pointer' : 'not-allowed' }}
                            onClick={() => {
                              if (isCompleted) {
                                window.open(`https://api.torbox.app/v1/api/torrents/requestdl?token=${apiKey}&torrent_id=${parentTorrentId}&file_id=${fileId}&redirect=true`, '_blank')
                              }
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                              <line x1="2" y1="10" x2="22" y2="10" />
                              <polygon points="10 11 15 13 10 15 10 11" fill="currentColor" />
                            </svg>
                            Stream
                          </button>
                        )}

                        <button 
                          className="action-btn"
                          title={isMultiFile ? "Download All as ZIP" : "Direct Download"}
                          disabled={!isCompleted}
                          style={{ opacity: isCompleted ? 1 : 0.3, cursor: isCompleted ? 'pointer' : 'not-allowed' }}
                          onClick={() => {
                            if (isCompleted) {
                              if (isMultiFile) {
                                window.open(`https://api.torbox.app/v1/api/torrents/requestdl?token=${apiKey}&torrent_id=${item.id}&zip_link=true&redirect=true`, '_blank')
                              } else {
                                window.open(`https://api.torbox.app/v1/api/torrents/requestdl?token=${apiKey}&torrent_id=${parentTorrentId}&file_id=${fileId}&redirect=true`, '_blank')
                              }
                            }
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          Download
                        </button>

                        {showZip && (
                          <button 
                            className="action-btn"
                            title="Download as ZIP"
                            disabled={!isCompleted}
                            style={{ opacity: isCompleted ? 1 : 0.3, cursor: isCompleted ? 'pointer' : 'not-allowed' }}
                            onClick={() => {
                              if (isCompleted) {
                                window.open(`https://api.torbox.app/v1/api/torrents/requestdl?token=${apiKey}&torrent_id=${item.id}&zip_link=true&redirect=true`, '_blank')
                              }
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                              <text x="12" y="16" fontSize="6.5" fontWeight="bold" fill="currentColor" stroke="none" textAnchor="middle">ZIP</text>
                            </svg>
                            ZIP
                          </button>
                        )}

                        <button 
                          className="action-btn"
                          title="Copy Download Link"
                          disabled={!isCompleted}
                          style={{ opacity: isCompleted ? 1 : 0.3, cursor: isCompleted ? 'pointer' : 'not-allowed' }}
                          onClick={() => {
                            if (isCompleted) {
                              let dlLink = ''
                              if (item.type === 'subfile') {
                                dlLink = `https://api.torbox.app/v1/api/torrents/requestdl?token=${apiKey}&torrent_id=${item.torrentId}&file_id=${item.fileId}&redirect=true`
                              } else if (isMultiFile) {
                                dlLink = `https://api.torbox.app/v1/api/torrents/requestdl?token=${apiKey}&torrent_id=${item.id}&zip_link=true&redirect=true`
                              } else {
                                dlLink = `https://api.torbox.app/v1/api/torrents/requestdl?token=${apiKey}&torrent_id=${item.id}&file_id=0&redirect=true`
                              }
                              navigator.clipboard.writeText(dlLink).then(() => alert('Direct download link copied to clipboard!'))
                            }
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            <line x1="12" y1="15" x2="19" y2="15" />
                            <line x1="15" y1="12" x2="15" y2="19" />
                          </svg>
                          Copy Link
                        </button>

                        {item.type === 'file' && (
                          <button 
                            className="action-btn"
                            title="Download Original Torrent"
                            onClick={() => {
                              window.open(`https://api.torbox.app/v1/api/torrents/exportdata?token=${apiKey}&torrent_id=${parentTorrentId}&type=torrent`, '_blank')
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                              <path d="M2 12h20" />
                            </svg>
                            Torrent
                          </button>
                        )}

                        {item.type === 'file' && (
                          <button 
                            className="action-btn"
                            title="Send to Cloud Integration"
                            onClick={() => {
                              window.open('https://torbox.app/dashboard', '_blank')
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" strokeDasharray="3 3" />
                              <polyline points="16 12 12 8 8 12" />
                              <line x1="12" y1="8" x2="12" y2="16" />
                            </svg>
                            Cloud
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Show current folder label if in "recent" or "tag" view */}
                    {(activeTab === 'recent' || activeTab.startsWith('tag_')) && vfs.itemMappings[item.id]?.folderId && vfs.itemMappings[item.id].folderId !== 'root' && (
                      <div style={{
                        fontSize: '0.7rem',
                        background: 'rgba(0, 210, 135, 0.1)',
                        color: 'var(--accent-color)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        marginLeft: '12px',
                        border: '1px solid rgba(0, 210, 135, 0.3)'
                      }}>
                        {vfs.folders.find(f => f.id === vfs.itemMappings[item.id].folderId)?.name || 'Folder'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
