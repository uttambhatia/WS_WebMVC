import { useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from "react";
import "./TreeHierarchySelector.css";
import MultiSelectDropdown from "../shared/MultiSelectDropdown";

function FolderIcon({ open = false }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {open ? (
        <>
          <path d="M2.05 6.35h11.9c.58 0 1 .56.83 1.11l-1.07 3.47a1.18 1.18 0 0 1-1.13.84H3.42a1.18 1.18 0 0 1-1.13-.84L1.22 7.46c-.17-.55.25-1.11.83-1.11Z" fill="currentColor" opacity="0.14" />
          <path d="M2.05 6.35h11.9c.58 0 1 .56.83 1.11l-1.07 3.47a1.18 1.18 0 0 1-1.13.84H3.42a1.18 1.18 0 0 1-1.13-.84L1.22 7.46c-.17-.55.25-1.11.83-1.11Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M1.75 5.2h4.12l1.02-1.22h2.9" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M1.45 4.7c0-.66.54-1.2 1.2-1.2h3.16l1.08 1.28h6.46c.66 0 1.2.54 1.2 1.2v5.35c0 .66-.54 1.2-1.2 1.2H2.65c-.66 0-1.2-.54-1.2-1.2V4.7Z" fill="currentColor" opacity="0.12" />
          <path d="M1.45 4.7c0-.66.54-1.2 1.2-1.2h3.16l1.08 1.28h6.46c.66 0 1.2.54 1.2 1.2v5.35c0 .66-.54 1.2-1.2 1.2H2.65c-.66 0-1.2-.54-1.2-1.2V4.7Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M1.7 6.12h12.6" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4 1.5h5.3L12.5 4.7V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M9.3 1.7v2.5h2.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.4 7.3h5.1M5.4 9.6h5.1" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function toPath(parentPath, name) {
  return parentPath ? `${parentPath}/${name}` : name;
}

function normalizeTreeData(rawData) {
  const tree = Array.isArray(rawData?.tree) ? rawData.tree : [];
  return tree.map((node) => normalizeNode(node, "", rawData?.scripts_root || ""));
}

function normalizeNode(node, parentPath, scriptsRoot) {
  const rawPath = node?.relative_path || toPath(parentPath, node?.name || "");
  const path = String(rawPath || "").replace(/^\/+/, "");
  const type = node?.type === "directory" ? "directory" : "file";

  if (type === "file") {
    return {
      type,
      name: node?.name || path.split("/").pop() || "",
      path,
      absolutePath: node?.absolute_path || toPath(String(scriptsRoot || "").replace(/\/$/, ""), path),
      children: [],
    };
  }

  const children = Array.isArray(node?.children)
    ? node.children.map((child) => normalizeNode(child, path, scriptsRoot))
    : [];

  return {
    type,
    name: node?.name || path.split("/").pop() || "",
    path,
    absolutePath: null,
    children,
  };
}

function flattenFiles(nodes) {
  const result = [];
  const walk = (node) => {
    if (node.type === "file") {
      const segments = node.path.split("/").filter(Boolean);
      result.push({
        name: node.name,
        relativePath: node.path,
        absolutePath: node.absolutePath,
        segments,
      });
      return;
    }
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return result;
}

function buildIndex(treeNodes) {
  const nodeMap = new Map();
  const parentMap = new Map();
  const directoryPaths = new Set();
  const fileMap = new Map();

  const walk = (node, parentPath = null) => {
    nodeMap.set(node.path, node);
    parentMap.set(node.path, parentPath);

    if (node.type === "directory") {
      directoryPaths.add(node.path);
      node.children.forEach((child) => walk(child, node.path));
    } else {
      fileMap.set(node.path, {
        relativePath: node.path,
        absolutePath: node.absolutePath,
        name: node.name,
      });
    }
  };

  treeNodes.forEach((n) => walk(n));

  const descendantFilesMap = new Map();
  const collectDescendantFiles = (path) => {
    if (descendantFilesMap.has(path)) {
      return descendantFilesMap.get(path);
    }

    const node = nodeMap.get(path);
    if (!node) {
      return [];
    }

    if (node.type === "file") {
      descendantFilesMap.set(path, [path]);
      return [path];
    }

    const collected = [];
    node.children.forEach((child) => {
      const childList = collectDescendantFiles(child.path);
      childList.forEach((item) => collected.push(item));
    });

    descendantFilesMap.set(path, collected);
    return collected;
  };

  const getAncestors = (path) => {
    const result = [];
    let current = parentMap.get(path);
    while (current) {
      result.push(current);
      current = parentMap.get(current);
    }
    return result;
  };

  return {
    nodeMap,
    fileMap,
    directoryPaths,
    descendantFilesMap,
    collectDescendantFiles,
    getAncestors,
  };
}

function buildSelectedTreeFromFiles(selectedRelativePaths, fileMap) {
  const roots = [];
  const rootMap = new Map();

  const ensureFolder = (children, folderPath, folderName) => {
    const existing = children.find((node) => node.type === "directory" && node.path === folderPath);
    if (existing) {
      return existing;
    }

    const created = {
      type: "directory",
      name: folderName,
      path: folderPath,
      children: [],
    };
    children.push(created);
    return created;
  };

  selectedRelativePaths.forEach((relativePath) => {
    const meta = fileMap.get(relativePath);
    if (!meta) {
      return;
    }

    const parts = relativePath.split("/").filter(Boolean);
    if (parts.length === 0) {
      return;
    }

    const rootKey = parts[0];
    let rootNode = rootMap.get(rootKey);

    if (!rootNode) {
      rootNode = {
        type: "directory",
        name: rootKey,
        path: rootKey,
        children: [],
      };
      rootMap.set(rootKey, rootNode);
      roots.push(rootNode);
    }

    let current = rootNode;
    for (let i = 1; i < parts.length - 1; i += 1) {
      const folderPath = parts.slice(0, i + 1).join("/");
      current = ensureFolder(current.children, folderPath, parts[i]);
    }

    current.children.push({
      type: "file",
      name: parts[parts.length - 1],
      path: relativePath,
      absolutePath: meta.absolutePath,
      children: [],
    });
  });

  const sortNodes = (nodes) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => {
      if (n.type === "directory") {
        sortNodes(n.children);
      }
    });
  };

  sortNodes(roots);
  return roots;
}

function computePathOptions(files, maxDepth) {
  const optionsByIndex = [];
  for (let idx = 0; idx < maxDepth; idx += 1) {
    const set = new Set();
    files.forEach((file) => {
      // Keep dropdown values folder-only; never include the filename segment.
      const folderDepth = Math.max(0, file.segments.length - 1);
      if (idx < folderDepth && file.segments[idx]) {
        set.add(file.segments[idx]);
      }
    });
    optionsByIndex.push(Array.from(set).sort((a, b) => a.localeCompare(b)));
  }
  return optionsByIndex;
}

function getFolderSegment(file, index) {
  const folderDepth = Math.max(0, file.segments.length - 1);
  if (index < 0 || index >= folderDepth) {
    return "";
  }
  return file.segments[index] || "";
}

function applyFilters(files, basicFilters, advancedFilter, streamIndex, regionIndex) {
  const streamSet = new Set(basicFilters.stream || []);
  const regionSet = new Set(basicFilters.region || []);
  const freeTags = (basicFilters.free || []).map((item) => item.toLowerCase());

  return files.filter((file) => {
    const rel = file.relativePath;
    const relLower = rel.toLowerCase();

    if (advancedFilter.enabled) {
      const keys = Object.keys(advancedFilter.values || {});
      return keys.every((key) => {
        const index = Number(key);
        const values = advancedFilter.values[key] || [];
        if (values.length === 0) {
          return true;
        }
        return values.includes(getFolderSegment(file, index));
      });
    }

    if (streamSet.size > 0) {
      const streamValue = getFolderSegment(file, streamIndex);
      if (!streamSet.has(streamValue)) {
        return false;
      }
    }

    if (regionSet.size > 0) {
      const regionValue = getFolderSegment(file, regionIndex);
      if (!regionSet.has(regionValue)) {
        return false;
      }
    }

    if (freeTags.length > 0) {
      const matchAny = freeTags.some((tag) => relLower.includes(tag));
      if (!matchAny) {
        return false;
      }
    }

    return true;
  });
}

function flattenVisibleEntries(treeNodes, expandedSet, parentPath = null, level = 1) {
  const out = [];

  treeNodes.forEach((node) => {
    out.push({
      node,
      path: node.path,
      parentPath,
      level,
    });

    if (node.type === "directory" && expandedSet.has(node.path)) {
      out.push(...flattenVisibleEntries(node.children, expandedSet, node.path, level + 1));
    }
  });

  return out;
}

function FilterPanel({
  title,
  files,
  streamIndex,
  regionIndex,
  basicFilters,
  setBasicFilters,
  advancedFilter,
  setAdvancedFilter,
  showAdvanceSearch = true,
  hideKeywordSearchInput = true,
  hideKeywordClearButton = true,
  hideKeywordNoOptionsLabel = true,
}) {
  const streamOptions = useMemo(() => {
    const set = new Set();
    files.forEach((file) => {
      const value = getFolderSegment(file, streamIndex);
      if (value) {
        set.add(value);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [files, streamIndex]);

  const regionOptions = useMemo(() => {
    const set = new Set();
    files.forEach((file) => {
      const value = getFolderSegment(file, regionIndex);
      if (value) {
        set.add(value);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [files, regionIndex]);

  const maxDepth = useMemo(() => {
    if (files.length === 0) {
      return 0;
    }
    return files.reduce((max, file) => Math.max(max, Math.max(0, file.segments.length - 1)), 0);
  }, [files]);

  const advanceOptions = useMemo(() => computePathOptions(files, maxDepth), [files, maxDepth]);

  const setBasicField = (field, value) => {
    setBasicFilters((prev) => ({ ...prev, [field]: value }));
  };

  const updateAdvancedAt = (index, value) => {
    setAdvancedFilter((prev) => ({
      ...prev,
      values: {
        ...prev.values,
        [index]: value,
      },
    }));
  };

  return (
    <div className="ths-filter-panel">
      <div className="ths-filter-panel-title-row">
        <h4>{title}</h4>
        <div className="ths-filter-panel-right">
          {showAdvanceSearch ? (
            <button
              type="button"
              className="ths-advance-toggle"
              onClick={() => {
                setAdvancedFilter((prev) => {
                  const nextEnabled = !prev.enabled;
                  return {
                    enabled: nextEnabled,
                    values: nextEnabled ? prev.values : {},
                  };
                });
                setBasicFilters({ stream: [], region: [], free: [] });
              }}
            >
              ⌕ Advance Search
            </button>
          ) : null}

        </div>
      </div>

      {!advancedFilter.enabled || !showAdvanceSearch ? (
        <div className="ths-basic-filter-grid">
          <MultiSelectDropdown
            label="Stream(s)"
            placeholder="Select stream"
            options={streamOptions}
            selected={basicFilters.stream}
            onChange={(value) => setBasicField("stream", value)}
          />
          <MultiSelectDropdown
            label="Region(s)"
            placeholder="Select region"
            options={regionOptions}
            selected={basicFilters.region}
            onChange={(value) => setBasicField("region", value)}
          />
          <MultiSelectDropdown
            label="Keyword(s)"
            placeholder="Add keyword"
            options={[]}
            selected={basicFilters.free}
            onChange={(value) => setBasicField("free", value)}
            allowCustom
            showSearchInput={!hideKeywordSearchInput}
            showClearButton={!hideKeywordClearButton}
            showNoOptionsLabel={!hideKeywordNoOptionsLabel}
          />
        </div>
      ) : (
        <div className="ths-advanced-panel">
          <div className="ths-advanced-grid">
            {advanceOptions.map((options, index) => {
              const selected = advancedFilter.values[index] || [];
              const dynamicLabel =
                index === 0
                  ? "Root"
                  : index === streamIndex
                    ? "Stream"
                    : index === regionIndex
                      ? "Region"
                      : "Application";

              return (
                <MultiSelectDropdown
                  key={`adv-${index}`}
                  label={`${dynamicLabel} (${index})`}
                  placeholder="Select"
                  options={options}
                  selected={selected}
                  onChange={(value) => updateAdvancedAt(index, value)}
                />
              );
            })}
          </div>
          <div className="ths-advanced-close-wrap">
            <button
              type="button"
              className="ths-advanced-close-btn"
              onClick={() => setAdvancedFilter({ enabled: false, values: {} })}
            >
              Close Advance Search
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TreeNode({
  pane,
  node,
  level,
  parentPath,
  expanded,
  focusedPath,
  onFocusPath,
  onKeyDown,
  onToggleExpand,
  renderNodeContent,
}) {
  const isDirectory = node.type === "directory";
  const isExpanded = expanded.has(node.path);

  return (
    <div className="ths-node-wrap">
      <div className="ths-node-row" style={{ paddingLeft: `${level * 16 + 8}px` }}>
        {isDirectory ? (
          <button
            type="button"
            className="ths-expand-btn"
            onClick={() => onToggleExpand(node.path)}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            tabIndex={-1}
          >
            {isExpanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="ths-expand-placeholder" />
        )}

        {renderNodeContent(node, {
          pane,
          level,
          parentPath,
          isDirectory,
          isExpanded,
          tabIndex: focusedPath === node.path ? 0 : -1,
          onFocus: () => onFocusPath(node.path),
          onKeyDown: (event) => onKeyDown(event, node, parentPath, isDirectory, isExpanded),
        })}
      </div>

      {isDirectory && isExpanded ? (
        <div className="ths-node-children" role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              pane={pane}
              node={child}
              level={level + 1}
              parentPath={node.path}
              expanded={expanded}
              focusedPath={focusedPath}
              onFocusPath={onFocusPath}
              onKeyDown={onKeyDown}
              onToggleExpand={onToggleExpand}
              renderNodeContent={renderNodeContent}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function filterTreeByVisibleFiles(treeNodes, visibleFilePaths) {
  const visibleSet = new Set(visibleFilePaths);

  const walk = (node) => {
    if (node.type === "file") {
      return visibleSet.has(node.path) ? node : null;
    }

    const children = node.children
      .map((child) => walk(child))
      .filter(Boolean);

    if (children.length === 0) {
      return null;
    }

    return {
      ...node,
      children,
    };
  };

  return treeNodes.map((node) => walk(node)).filter(Boolean);
}

function collectDirectoryPaths(treeNodes) {
  const paths = [];
  const walk = (node) => {
    if (node.type !== "directory") {
      return;
    }
    paths.push(node.path);
    node.children.forEach(walk);
  };
  treeNodes.forEach(walk);
  return paths;
}

const TreeHierarchySelector = forwardRef(function TreeHierarchySelector(
  {
    data,
    fetchHierarchy,
    streamPathIndex = 1,
    regionPathIndex = 2,
    lockAutoSelectedParents = false,
    showLeftPaneAdvanceSearch = false,
    showRightPaneAdvanceSearch = false,
    hideKeywordSearchInput = true,
    hideKeywordClearButton = true,
    hideKeywordNoOptionsLabel = true,
    rightPaneRemoveIconScope = "file",
    title = "Script Selection",
  },
  ref,
) {
  const [treeNodes, setTreeNodes] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(fetchHierarchy));
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [manualFolderSelections, setManualFolderSelections] = useState(new Set());

  const [leftExpanded, setLeftExpanded] = useState(new Set());
  const [rightExpanded, setRightExpanded] = useState(new Set());

  const [leftWidthPct, setLeftWidthPct] = useState(54);
  const dragStateRef = useRef({ dragging: false });

  const [leftBasicFilters, setLeftBasicFilters] = useState({ stream: [], region: [], free: [] });
  const [rightBasicFilters, setRightBasicFilters] = useState({ stream: [], region: [], free: [] });

  const [leftAdvancedFilter, setLeftAdvancedFilter] = useState({ enabled: false, values: {} });
  const [rightAdvancedFilter, setRightAdvancedFilter] = useState({ enabled: false, values: {} });
  const [focusedLeftPath, setFocusedLeftPath] = useState("");
  const [focusedRightPath, setFocusedRightPath] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setIsLoading(true);
        setError("");
        const payload = fetchHierarchy ? await fetchHierarchy() : data;
        if (!mounted) {
          return;
        }

        const normalized = normalizeTreeData(payload || {});
        setTreeNodes(normalized);

        const initialExpanded = new Set();
        const collectDirs = (node) => {
          if (node.type === "directory") {
            initialExpanded.add(node.path);
            node.children.forEach(collectDirs);
          }
        };
        normalized.forEach(collectDirs);

        setLeftExpanded(initialExpanded);
        setRightExpanded(initialExpanded);
      } catch (loadError) {
        if (mounted) {
          setError(loadError?.message || "Unable to load hierarchy");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [data, fetchHierarchy, retryCount]);

  const index = useMemo(() => buildIndex(treeNodes), [treeNodes]);

  const allFiles = useMemo(() => flattenFiles(treeNodes), [treeNodes]);

  const selectedRelativePaths = useMemo(() => Array.from(selectedFiles).sort((a, b) => a.localeCompare(b)), [selectedFiles]);

  const selectedAbsolutePaths = useMemo(
    () => selectedRelativePaths.map((path) => index.fileMap.get(path)?.absolutePath).filter(Boolean),
    [selectedRelativePaths, index.fileMap],
  );

  useImperativeHandle(
    ref,
    () => ({
      getSelectedRelativePaths: () => selectedRelativePaths,
      getSelectedAbsolutePaths: () => selectedAbsolutePaths,
      clearSelection: () => {
        setSelectedFiles(new Set());
        setManualFolderSelections(new Set());
      },
    }),
    [selectedRelativePaths, selectedAbsolutePaths],
  );

  const selectedTree = useMemo(
    () => buildSelectedTreeFromFiles(selectedRelativePaths, index.fileMap),
    [selectedRelativePaths, index.fileMap],
  );

  const selectedFilesMeta = useMemo(
    () => selectedRelativePaths.map((path) => ({
      relativePath: path,
      absolutePath: index.fileMap.get(path)?.absolutePath,
      segments: path.split("/").filter(Boolean),
    })),
    [selectedRelativePaths, index.fileMap],
  );

  const leftVisibleFiles = useMemo(
    () => applyFilters(allFiles, leftBasicFilters, leftAdvancedFilter, streamPathIndex, regionPathIndex),
    [allFiles, leftBasicFilters, leftAdvancedFilter, streamPathIndex, regionPathIndex],
  );

  const rightVisibleFiles = useMemo(
    () => applyFilters(selectedFilesMeta, rightBasicFilters, rightAdvancedFilter, streamPathIndex, regionPathIndex),
    [selectedFilesMeta, rightBasicFilters, rightAdvancedFilter, streamPathIndex, regionPathIndex],
  );

  const leftVisibleTree = useMemo(
    () => filterTreeByVisibleFiles(treeNodes, leftVisibleFiles.map((file) => file.relativePath)),
    [treeNodes, leftVisibleFiles],
  );

  const leftVisibleFilePathSet = useMemo(
    () => new Set(leftVisibleFiles.map((file) => file.relativePath)),
    [leftVisibleFiles],
  );

  const rightVisibleTree = useMemo(
    () => filterTreeByVisibleFiles(selectedTree, rightVisibleFiles.map((file) => file.relativePath)),
    [selectedTree, rightVisibleFiles],
  );

  const leftVisibleEntries = useMemo(
    () => flattenVisibleEntries(leftVisibleTree, leftExpanded),
    [leftVisibleTree, leftExpanded],
  );

  const rightVisibleEntries = useMemo(
    () => flattenVisibleEntries(rightVisibleTree, rightExpanded),
    [rightVisibleTree, rightExpanded],
  );

  const leftVisibleDirectoryPaths = useMemo(
    () => collectDirectoryPaths(leftVisibleTree),
    [leftVisibleTree],
  );

  const rightVisibleDirectoryPaths = useMemo(
    () => collectDirectoryPaths(rightVisibleTree),
    [rightVisibleTree],
  );

  const isLeftAllExpanded = useMemo(
    () =>
      leftVisibleDirectoryPaths.length > 0 &&
      leftVisibleDirectoryPaths.every((path) => leftExpanded.has(path)),
    [leftVisibleDirectoryPaths, leftExpanded],
  );

  const isRightAllExpanded = useMemo(
    () =>
      rightVisibleDirectoryPaths.length > 0 &&
      rightVisibleDirectoryPaths.every((path) => rightExpanded.has(path)),
    [rightVisibleDirectoryPaths, rightExpanded],
  );

  useEffect(() => {
    if (leftVisibleEntries.length === 0) {
      setFocusedLeftPath("");
      return;
    }
    const exists = leftVisibleEntries.some((entry) => entry.path === focusedLeftPath);
    if (!exists) {
      setFocusedLeftPath(leftVisibleEntries[0].path);
    }
  }, [leftVisibleEntries, focusedLeftPath]);

  useEffect(() => {
    if (rightVisibleEntries.length === 0) {
      setFocusedRightPath("");
      return;
    }
    const exists = rightVisibleEntries.some((entry) => entry.path === focusedRightPath);
    if (!exists) {
      setFocusedRightPath(rightVisibleEntries[0].path);
    }
  }, [rightVisibleEntries, focusedRightPath]);

  const toggleExpanded = (setter) => (path) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const expandAllVisible = (setter, directoryPaths) => {
    setter(new Set(directoryPaths));
  };

  const collapseAllVisible = (setter) => {
    setter(new Set());
  };

  const canRemoveRightNode = (node) => {
    if (!node) {
      return false;
    }
    if (rightPaneRemoveIconScope === "all") {
      return true;
    }
    return node.type === "file";
  };

  const focusTreeItem = (pane, path) => {
    const selector = `.ths-node-content[data-pane='${pane}'][data-path='${path}']`;
    const node = document.querySelector(selector);
    if (node) {
      node.focus();
    }
  };

  const handleTreeKeyDown = (pane, event, node, parentPath, isDirectory, isExpanded) => {
    const entries = pane === "left" ? leftVisibleEntries : rightVisibleEntries;
    const focusedPath = pane === "left" ? focusedLeftPath : focusedRightPath;
    const setFocusedPath = pane === "left" ? setFocusedLeftPath : setFocusedRightPath;

    const currentIndex = entries.findIndex((entry) => entry.path === focusedPath);
    const moveFocus = (targetIndex) => {
      const bounded = Math.max(0, Math.min(entries.length - 1, targetIndex));
      const nextPath = entries[bounded]?.path;
      if (!nextPath) {
        return;
      }
      setFocusedPath(nextPath);
      requestAnimationFrame(() => focusTreeItem(pane, nextPath));
    };

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (currentIndex >= 0) {
          moveFocus(currentIndex + 1);
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (currentIndex >= 0) {
          moveFocus(currentIndex - 1);
        }
        break;
      case "Home":
        event.preventDefault();
        moveFocus(0);
        break;
      case "End":
        event.preventDefault();
        moveFocus(entries.length - 1);
        break;
      case "ArrowRight":
        if (!isDirectory) {
          return;
        }
        event.preventDefault();
        if (!isExpanded) {
          if (pane === "left") {
            toggleExpanded(setLeftExpanded)(node.path);
          } else {
            toggleExpanded(setRightExpanded)(node.path);
          }
          return;
        }
        if (currentIndex >= 0 && entries[currentIndex + 1]?.parentPath === node.path) {
          moveFocus(currentIndex + 1);
        }
        break;
      case "ArrowLeft":
        if (isDirectory && isExpanded) {
          event.preventDefault();
          if (pane === "left") {
            toggleExpanded(setLeftExpanded)(node.path);
          } else {
            toggleExpanded(setRightExpanded)(node.path);
          }
          return;
        }
        if (parentPath) {
          event.preventDefault();
          const parentIndex = entries.findIndex((entry) => entry.path === parentPath);
          if (parentIndex >= 0) {
            moveFocus(parentIndex);
          }
        }
        break;
      case " ":
      case "Enter":
        event.preventDefault();
        if (pane === "left") {
          onToggleLeftCheckbox(node);
        } else if (canRemoveRightNode(node)) {
          onRemoveFromRight(node);
        }
        break;
      case "Delete":
      case "Backspace":
        if (pane === "right" && canRemoveRightNode(node)) {
          event.preventDefault();
          onRemoveFromRight(node);
        }
        break;
      default:
        break;
    }
  };

  const removeFiles = (relativePaths) => {
    const removeSet = new Set(relativePaths);

    setSelectedFiles((prev) => {
      const next = new Set(prev);
      removeSet.forEach((path) => next.delete(path));
      return next;
    });

    setManualFolderSelections((prev) => {
      const next = new Set(prev);
      Array.from(next).forEach((folderPath) => {
        const isInRemovedBranch = relativePaths.some((removedPath) =>
          removedPath === folderPath || removedPath.startsWith(`${folderPath}/`),
        );
        if (isInRemovedBranch) {
          next.delete(folderPath);
        }
      });
      return next;
    });
  };

  const getSelectableDescendantFiles = (nodePath) => {
    const allDescendants = index.collectDescendantFiles(nodePath);
    const visibleDescendants = allDescendants.filter((path) => leftVisibleFilePathSet.has(path));
    return visibleDescendants.length > 0 ? visibleDescendants : allDescendants;
  };

  const onToggleLeftCheckbox = (node) => {
    if (node.type === "file") {
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        if (next.has(node.path)) {
          next.delete(node.path);
        } else {
          next.add(node.path);
        }
        return next;
      });
      return;
    }

    const descendantFiles = getSelectableDescendantFiles(node.path);
    const hasSelected = descendantFiles.some((path) => selectedFiles.has(path));

    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (hasSelected) {
        descendantFiles.forEach((path) => next.delete(path));
      } else {
        descendantFiles.forEach((path) => next.add(path));
      }
      return next;
    });

    setManualFolderSelections((prev) => {
      const next = new Set(prev);
      if (hasSelected) {
        Array.from(next).forEach((folderPath) => {
          if (folderPath === node.path || folderPath.startsWith(`${node.path}/`)) {
            next.delete(folderPath);
          }
        });
      } else {
        next.add(node.path);
      }
      return next;
    });
  };

  const onRemoveFromRight = (node) => {
    if (!canRemoveRightNode(node)) {
      return;
    }

    if (node.type === "file") {
      removeFiles([node.path]);
      return;
    }

    const descendantFiles = index.collectDescendantFiles(node.path);
    removeFiles(descendantFiles);
  };

  const getDirectoryState = (nodePath) => {
    const descendants = getSelectableDescendantFiles(nodePath);
    const selectedCount = descendants.reduce((count, filePath) => (selectedFiles.has(filePath) ? count + 1 : count), 0);

    return {
      hasAny: selectedCount > 0,
      partial: selectedCount > 0 && selectedCount < descendants.length,
      total: descendants.length,
    };
  };

  useEffect(() => {
    const onMove = (event) => {
      if (!dragStateRef.current.dragging) {
        return;
      }

      const container = dragStateRef.current.container;
      if (!container) {
        return;
      }

      const bounds = container.getBoundingClientRect();
      const pct = ((event.clientX - bounds.left) / bounds.width) * 100;
      const clamped = Math.max(25, Math.min(75, pct));
      setLeftWidthPct(clamped);
    };

    const onUp = () => {
      dragStateRef.current.dragging = false;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const leftPaneRef = useRef(null);

  if (isLoading) {
    return <div className="ths-status" role="status" aria-live="polite">Loading hierarchy from service...</div>;
  }

  if (error) {
    return (
      <div className="ths-status ths-status-error" role="alert">
        <p>{error}</p>
        <button type="button" className="ths-retry-btn" onClick={() => setRetryCount((prev) => prev + 1)}>
          Retry Loading
        </button>
      </div>
    );
  }

  return (
    <section className="ths-shell">
      <header className="ths-header">
        <div>
          <h2>{title}</h2>
          <p>
            Select files and folders from the left tree, and manage selected hierarchy on the right.
          </p>
        </div>
      </header>

      <div className="ths-container" ref={leftPaneRef}>
        <div className="ths-pane" style={{ width: `${leftWidthPct}%` }}>
          <FilterPanel
            title="Left Pane Filters"
            files={allFiles}
            streamIndex={streamPathIndex}
            regionIndex={regionPathIndex}
            basicFilters={leftBasicFilters}
            setBasicFilters={setLeftBasicFilters}
            advancedFilter={leftAdvancedFilter}
            setAdvancedFilter={setLeftAdvancedFilter}
            showAdvanceSearch={showLeftPaneAdvanceSearch}
            hideKeywordSearchInput={hideKeywordSearchInput}
            hideKeywordClearButton={hideKeywordClearButton}
            hideKeywordNoOptionsLabel={hideKeywordNoOptionsLabel}
          />

          <div className="ths-tree-toolbar" role="group" aria-label="Left pane tree controls">
            <button
              type="button"
              className="ths-tree-toggle"
              disabled={leftVisibleDirectoryPaths.length === 0}
              aria-label={isLeftAllExpanded ? "Collapse all tree nodes" : "Expand all tree nodes"}
              onClick={() => {
                if (isLeftAllExpanded) {
                  collapseAllVisible(setLeftExpanded);
                } else {
                  expandAllVisible(setLeftExpanded, leftVisibleDirectoryPaths);
                }
              }}
            >
              <span className="ths-tree-toggle-text">{isLeftAllExpanded ? "Collapse" : "Expand"}</span>
              <span className="ths-tree-toggle-icon" aria-hidden="true">{isLeftAllExpanded ? "-" : "+"}</span>
            </button>
          </div>

          <div className="ths-tree" role="tree" aria-label="Left hierarchy with selection" aria-multiselectable="true">
            {leftVisibleTree.length === 0 ? (
              <div className="ths-empty-row">No files matched filters.</div>
            ) : (
              leftVisibleTree.map((node) => (
                <TreeNode
                  key={`left-${node.path}`}
                  pane="left"
                  node={node}
                  level={0}
                  parentPath={null}
                  expanded={leftExpanded}
                  focusedPath={focusedLeftPath}
                  onFocusPath={setFocusedLeftPath}
                  onKeyDown={(event, treeNode, parentPath, isDirectory, isExpanded) =>
                    handleTreeKeyDown("left", event, treeNode, parentPath, isDirectory, isExpanded)
                  }
                  onToggleExpand={toggleExpanded(setLeftExpanded)}
                  renderNodeContent={(treeNode, navState) => {
                    const isDirectory = treeNode.type === "directory";
                    const dirState = isDirectory ? getDirectoryState(treeNode.path) : null;
                    const checked = isDirectory ? dirState.hasAny : selectedFiles.has(treeNode.path);
                    const disabled =
                      isDirectory &&
                      lockAutoSelectedParents &&
                      checked &&
                      !manualFolderSelections.has(treeNode.path);

                    const ariaChecked =
                      isDirectory && dirState?.partial ? "mixed" : checked ? "true" : "false";

                    return (
                      <button
                        type="button"
                        role="treeitem"
                        aria-level={navState.level}
                        aria-expanded={isDirectory ? navState.isExpanded : undefined}
                        aria-checked={ariaChecked}
                        aria-disabled={disabled}
                        className={`ths-node-content ${disabled ? "is-disabled" : ""}`}
                        data-pane={navState.pane}
                        data-path={treeNode.path}
                        tabIndex={navState.tabIndex}
                        onFocus={navState.onFocus}
                        onKeyDown={navState.onKeyDown}
                        onClick={() => onToggleLeftCheckbox(treeNode)}
                        disabled={disabled}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          tabIndex={-1}
                          aria-hidden="true"
                          readOnly
                          ref={(element) => {
                            if (!element || !isDirectory || !dirState) {
                              return;
                            }
                            element.indeterminate = dirState.partial;
                          }}
                          onChange={() => {}}
                        />
                        <span className={`ths-node-icon ${isDirectory ? "is-dir" : "is-file"} ${checked ? "is-selected" : ""} ${isDirectory && navState.isExpanded ? "is-open" : ""}`.trim()}>
                          {isDirectory ? <FolderIcon open={Boolean(navState.isExpanded)} /> : <FileIcon />}
                        </span>
                        <span className="ths-node-label">{treeNode.name}</span>
                      </button>
                    );
                  }}
                />
              ))
            )}
          </div>
        </div>

        <div
          className="ths-divider"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panes"
          onMouseDown={() => {
            dragStateRef.current = {
              dragging: true,
              container: leftPaneRef.current,
            };
          }}
        >
          <span className="ths-divider-grip" />
        </div>

        <div className="ths-pane" style={{ width: `${100 - leftWidthPct}%` }}>
          <FilterPanel
            title="Right Pane Filters"
            files={selectedFilesMeta}
            streamIndex={streamPathIndex}
            regionIndex={regionPathIndex}
            basicFilters={rightBasicFilters}
            setBasicFilters={setRightBasicFilters}
            advancedFilter={rightAdvancedFilter}
            setAdvancedFilter={setRightAdvancedFilter}
            showAdvanceSearch={showRightPaneAdvanceSearch}
            hideKeywordSearchInput={hideKeywordSearchInput}
            hideKeywordClearButton={hideKeywordClearButton}
            hideKeywordNoOptionsLabel={hideKeywordNoOptionsLabel}
          />

          <div className="ths-tree-toolbar" role="group" aria-label="Right pane tree controls">
            <button
              type="button"
              className="ths-tree-toggle"
              disabled={rightVisibleDirectoryPaths.length === 0}
              aria-label={isRightAllExpanded ? "Collapse all tree nodes" : "Expand all tree nodes"}
              onClick={() => {
                if (isRightAllExpanded) {
                  collapseAllVisible(setRightExpanded);
                } else {
                  expandAllVisible(setRightExpanded, rightVisibleDirectoryPaths);
                }
              }}
            >
              <span className="ths-tree-toggle-text">{isRightAllExpanded ? "Collapse" : "Expand"}</span>
              <span className="ths-tree-toggle-icon" aria-hidden="true">{isRightAllExpanded ? "-" : "+"}</span>
            </button>
            <span className="ths-info-badge ths-tree-toolbar-info-right">
              {selectedRelativePaths.length} selected file(s)
            </span>
          </div>

          <div className="ths-tree" role="tree" aria-label="Right selected hierarchy" aria-multiselectable="true">
            {rightVisibleTree.length === 0 ? (
              <div className="ths-empty-row">No selected files for current filters.</div>
            ) : (
              rightVisibleTree.map((node) => (
                <TreeNode
                  key={`right-${node.path}`}
                  pane="right"
                  node={node}
                  level={0}
                  parentPath={null}
                  expanded={rightExpanded}
                  focusedPath={focusedRightPath}
                  onFocusPath={setFocusedRightPath}
                  onKeyDown={(event, treeNode, parentPath, isDirectory, isExpanded) =>
                    handleTreeKeyDown("right", event, treeNode, parentPath, isDirectory, isExpanded)
                  }
                  onToggleExpand={toggleExpanded(setRightExpanded)}
                  renderNodeContent={(treeNode, navState) => {
                    const isDirectory = treeNode.type === "directory";
                    const showRemoveIcon = canRemoveRightNode(treeNode);
                    return (
                      <div
                        role="treeitem"
                        aria-level={navState.level}
                        aria-expanded={isDirectory ? navState.isExpanded : undefined}
                        className="ths-node-content is-readonly"
                        data-pane={navState.pane}
                        data-path={treeNode.path}
                        tabIndex={navState.tabIndex}
                        onFocus={navState.onFocus}
                        onKeyDown={navState.onKeyDown}
                      >
                        <span className={`ths-node-icon ${isDirectory ? "is-dir" : "is-file"} is-selected ${isDirectory && navState.isExpanded ? "is-open" : ""}`.trim()}>
                          {isDirectory ? <FolderIcon open={Boolean(navState.isExpanded)} /> : <FileIcon />}
                        </span>
                        <span className="ths-node-label">{treeNode.name}</span>
                        {showRemoveIcon ? (
                          <button
                            type="button"
                            className="ths-remove-btn"
                            onClick={() => onRemoveFromRight(treeNode)}
                            aria-label={`Remove ${treeNode.name}`}
                            title={`Remove ${treeNode.name}`}
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    );
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
});

export default TreeHierarchySelector;
