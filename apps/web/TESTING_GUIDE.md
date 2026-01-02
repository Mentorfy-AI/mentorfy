# Testing Guide: Folder System

This guide provides comprehensive testing procedures for the complete folder system implementation.

## Prerequisites

- Frontend dev server running (`npm run dev`)
- Backend API running with Graphiti integration
- Supabase database with folder schema applied
- Neo4j with migrated episodes (see `GRAPHITI_MIGRATION.md`)

## Test Environment Setup

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Verify Database Schema**
   - Check that `folder` table exists
   - Verify `document.folder_id` column exists
   - Confirm RLS policies are active

3. **Verify Graphiti Migration**
   - Check that episodes have `group_id` set
   - Confirm organization isolation is working

---

## Phase 1: Folder Operations Testing

### Test 1.1: Create Root Folder

**Steps:**
1. Navigate to `/knowledge` page
2. Click "New Folder" button in sidebar
3. Enter name: "Engineering Docs"
4. Leave parent folder as "Root (No folder)"
5. Submit

**Expected Results:**
- ✅ Folder appears in sidebar immediately (optimistic update)
- ✅ Folder shows with proper icon and name
- ✅ Success toast notification appears
- ✅ Folder has document count of 0

**Database Verification:**
```sql
SELECT id, name, parent_folder_id, organization_id
FROM folder
WHERE name = 'Engineering Docs';
```

### Test 1.2: Create Nested Folder

**Steps:**
1. Right-click "Engineering Docs" folder
2. Select "New Subfolder" from context menu
3. Enter name: "Backend"
4. Submit

**Expected Results:**
- ✅ Subfolder appears under parent
- ✅ Folder is indented visually (left padding)
- ✅ Parent folder shows expand/collapse chevron
- ✅ Parent folder is auto-expanded

**Database Verification:**
```sql
SELECT f.id, f.name, f.parent_folder_id, p.name as parent_name
FROM folder f
LEFT JOIN folder p ON f.parent_folder_id = p.id
WHERE f.name = 'Backend';
```

### Test 1.3: Rename Folder

**Steps:**
1. Double-click "Backend" folder
2. Edit name to "Backend Services"
3. Press Enter to confirm

**Alternative:**
1. Right-click folder
2. Select "Rename"
3. Edit name
4. Click outside to blur (save)

**Expected Results:**
- ✅ Name updates immediately
- ✅ Input field auto-focuses
- ✅ Success toast appears
- ✅ Escape key cancels edit

**Database Verification:**
```sql
SELECT name, updated_at FROM folder WHERE name = 'Backend Services';
```

### Test 1.4: Delete Empty Folder

**Steps:**
1. Right-click "Backend Services" folder (ensure it's empty)
2. Select "Delete"
3. Confirm deletion in prompt

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ Folder is removed from tree
- ✅ Success toast appears
- ✅ If folder was selected, selection resets to "All Documents"

**Database Verification:**
```sql
-- Should return 0 rows
SELECT * FROM folder WHERE name = 'Backend Services';
```

### Test 1.5: Prevent Deleting Non-Empty Folder

**Steps:**
1. Create folder with documents in it
2. Attempt to delete folder
3. Observe error message

**Expected Results:**
- ❌ Deletion fails with error toast
- ✅ Error message explains folder must be empty
- ✅ Folder remains in tree

### Test 1.6: Folder Name Uniqueness

**Steps:**
1. Create folder "Test Folder" in root
2. Attempt to create another "Test Folder" in root
3. Try creating "Test Folder" in a different parent folder

**Expected Results:**
- ❌ Duplicate name in same parent blocked
- ✅ Error toast with explanation
- ✅ Same name in different parent allowed

**Database Verification:**
```sql
-- Check unique constraint
SELECT name, parent_folder_id FROM folder WHERE name = 'Test Folder';
```

### Test 1.7: Circular Reference Prevention

**Steps:**
1. Create folder hierarchy: "A" → "B" → "C"
2. Attempt to move folder "A" into folder "C" (its descendant)

**Expected Results:**
- ❌ Move operation blocked
- ✅ Error toast: "Cannot move folder to its own descendant"
- ✅ Folder remains in original location

---

## Phase 2: Document Operations Testing

### Test 2.1: Upload Document to Folder

**Steps:**
1. Select "Engineering Docs" folder
2. Click "Upload" button
3. Select folder in upload dialog
4. Upload test file

**Expected Results:**
- ✅ Upload modal shows folder selector
- ✅ Selected folder is pre-selected in dropdown
- ✅ Document appears in folder after upload
- ✅ Document count updates on folder

**Database Verification:**
```sql
SELECT d.title, d.folder_id, f.name as folder_name
FROM document d
LEFT JOIN folder f ON d.folder_id = f.id
WHERE d.title = 'your-test-file.pdf';
```

### Test 2.2: Upload Document to Root (No Folder)

**Steps:**
1. Click "All Documents" in sidebar
2. Upload document without selecting folder

**Expected Results:**
- ✅ Document uploads successfully
- ✅ `folder_id` is NULL
- ✅ Document appears in "All Documents" view

### Test 2.3: Move Document via Drag & Drop

**Steps:**
1. View documents in "All Documents"
2. Drag document card by the icon area
3. Drop onto "Engineering Docs" folder in sidebar

**Expected Results:**
- ✅ Visual feedback during drag (opacity, scale)
- ✅ Folder highlights when dragging over it
- ✅ Document disappears from "All Documents"
- ✅ Document appears in "Engineering Docs"
- ✅ Success toast notification

**Database Verification:**
```sql
SELECT title, folder_id FROM document WHERE id = 'dragged-doc-id';
```

### Test 2.4: View Documents in Folder

**Steps:**
1. Click on "Engineering Docs" folder
2. Observe filtered document list

**Expected Results:**
- ✅ Only documents in that folder shown
- ✅ Header shows folder name context
- ✅ Document count displayed correctly
- ✅ Empty state if no documents

### Test 2.5: View Unfiled Documents

**Steps:**
1. Click "All Documents"
2. Observe all documents including those without folders

**Expected Results:**
- ✅ All documents visible
- ✅ Documents from all folders shown
- ✅ Unfiled documents included

---

## Phase 3: Bulk Operations Testing

### Test 3.1: Select Multiple Documents

**Steps:**
1. Click first document card
2. Hold Shift/Ctrl and click additional documents
3. Observe selection state

**Expected Results:**
- ✅ Checkboxes show checked state
- ✅ Selected cards have visual highlight (border, background)
- ✅ Bulk action bar appears at bottom
- ✅ Bar shows correct count

### Test 3.2: Select All Documents

**Steps:**
1. Click "Select All" button
2. Observe all visible documents selected

**Alternative:**
1. Press Cmd/Ctrl + A

**Expected Results:**
- ✅ All filtered documents selected
- ✅ All checkboxes checked
- ✅ Bulk action bar shows total count
- ✅ Only visible documents selected (respects filters)

### Test 3.3: Bulk Move to Folder

**Steps:**
1. Select 3-5 documents
2. In bulk action bar, select folder from dropdown
3. Observe move operation

**Expected Results:**
- ✅ All selected documents move to folder
- ✅ Success toast with count
- ✅ Documents disappear from current view (if filtered)
- ✅ Selection cleared after operation
- ✅ Folder document count updates

**Database Verification:**
```sql
SELECT title, folder_id FROM document WHERE id IN ('id1', 'id2', 'id3');
```

### Test 3.4: Bulk Delete Documents

**Steps:**
1. Select 2-3 documents
2. Click "Delete" button in bulk action bar
3. Confirm deletion

**Expected Results:**
- ✅ Confirmation dialog shows count
- ✅ All selected documents deleted
- ✅ Success toast with count
- ✅ Documents removed from UI
- ✅ Selection cleared

**Database Verification:**
```sql
-- Should return 0 rows
SELECT * FROM document WHERE id IN ('deleted-id1', 'deleted-id2');
```

### Test 3.5: Clear Selection

**Steps:**
1. Select multiple documents
2. Click "X" button in bulk action bar

**Alternative:**
1. Press Escape key

**Expected Results:**
- ✅ All selections cleared
- ✅ Bulk action bar disappears
- ✅ Checkboxes unchecked
- ✅ Visual highlights removed

---

## Phase 4: Drag & Drop Testing

### Test 4.1: Drag Document to Folder

**Steps:**
1. Drag document by icon area
2. Hover over target folder in sidebar
3. Drop

**Expected Results:**
- ✅ Cursor changes to "grabbing"
- ✅ Document card shows dragging state (opacity 50%, scaled)
- ✅ Target folder highlights with ring
- ✅ Document moves successfully
- ✅ Toast notification appears

### Test 4.2: Drag Folder to Another Folder (Nesting)

**Steps:**
1. Drag "Backend" folder
2. Drop onto "Engineering Docs" folder
3. Observe nesting

**Expected Results:**
- ✅ Folder becomes child of target
- ✅ Visual indentation updates
- ✅ Parent folder auto-expands
- ✅ Success toast appears

### Test 4.3: Drag Folder to Root

**Steps:**
1. Drag nested folder
2. Drop onto "All Documents" or root area

**Expected Results:**
- ✅ Folder moves to root level
- ✅ `parent_folder_id` becomes NULL
- ✅ Indentation removed

### Test 4.4: Cancel Drag Operation

**Steps:**
1. Start dragging document or folder
2. Press Escape key OR drag outside droppable area
3. Release

**Expected Results:**
- ✅ Drag operation cancelled
- ✅ Item returns to original location
- ✅ No database changes made

### Test 4.5: Visual Feedback During Drag

**Verify:**
- ✅ Dragged item shows opacity and scale changes
- ✅ Drop targets highlight on hover
- ✅ Cursor changes appropriately
- ✅ Smooth animations
- ✅ No flickering or visual glitches

---

## Phase 5: Multi-Tenancy & Isolation Testing

### Test 5.1: Folder Organization Isolation

**Steps:**
1. Log in as User A (Org 1)
2. Create folders and documents
3. Log in as User B (Org 2)
4. Attempt to view Org 1's folders

**Expected Results:**
- ❌ User B cannot see Org 1's folders
- ✅ User B sees empty folder list
- ✅ RLS policies enforced

**Database Verification:**
```sql
-- As superuser
SELECT organization_id, COUNT(*) as folder_count
FROM folder
GROUP BY organization_id;
```

### Test 5.2: Document Organization Isolation

**Steps:**
1. Upload documents as Org 1
2. Log in as Org 2
3. Try to access Org 1's documents

**Expected Results:**
- ❌ Org 2 cannot see Org 1 documents
- ✅ API returns empty array
- ✅ RLS policies enforced

### Test 5.3: Graphiti Episode Isolation

**Steps:**
1. Upload document with folder assignment as Org 1
2. Verify episode created with correct `group_id`
3. Search via Graphiti as Org 2
4. Verify Org 1 documents not returned

**Expected Results:**
- ✅ Episode has `group_id` = Org 1 UUID
- ✅ Episode metadata includes `organization_id`, `folder_id`
- ❌ Org 2 search does not return Org 1 episodes

**Neo4j Verification:**
```cypher
MATCH (e:Episode)
WHERE e.group_id = "75e3e9e7-c942-46a8-a815-4261f087aa11"
RETURN e.name, e.group_id, e.metadata
LIMIT 10
```

### Test 5.4: Cross-Organization Attack Prevention

**Steps:**
1. Get folder ID from Org 1
2. As Org 2 user, attempt API call to update Org 1 folder
   ```
   PATCH /api/folders/{org1-folder-id}
   ```

**Expected Results:**
- ❌ 403 Forbidden or 404 Not Found
- ✅ No changes made to Org 1 folder
- ✅ Error logged

---

## Phase 6: Edge Cases & Error Handling

### Test 6.1: Deep Folder Nesting

**Steps:**
1. Create 10+ levels of nested folders
2. Test expand/collapse
3. Test moving documents to deeply nested folders

**Expected Results:**
- ✅ All levels render correctly
- ✅ Visual indentation works at all depths
- ✅ No performance issues
- ✅ Drag & drop works at all levels

### Test 6.2: Long Folder Names

**Steps:**
1. Create folder with 100+ character name
2. Observe truncation in UI
3. Test editing

**Expected Results:**
- ✅ Name truncates with ellipsis in sidebar
- ✅ Full name visible on hover (title attribute)
- ✅ Name saves correctly to database
- ✅ Edit mode shows full name

### Test 6.3: Special Characters in Folder Names

**Steps:**
1. Create folders with names: `"Test & Dev"`, `"Client: Acme Corp"`, `"Reports (Q4)"`

**Expected Results:**
- ✅ Special characters saved correctly
- ✅ No XSS vulnerabilities
- ✅ Proper escaping in UI
- ✅ Search works with special chars

### Test 6.4: Concurrent Operations

**Steps:**
1. Open two browser tabs as same user
2. Create folder in Tab 1
3. Observe Tab 2

**Expected Results:**
- ⚠️ Tab 2 may not auto-refresh (expected)
- ✅ Refresh Tab 2 shows new folder
- ✅ No data corruption
- ✅ No conflicts on save

### Test 6.5: Network Failure Handling

**Steps:**
1. Disconnect network
2. Attempt folder creation
3. Reconnect network
4. Retry operation

**Expected Results:**
- ❌ Error toast: "Network error" or similar
- ✅ Optimistic update reverted (if applied)
- ✅ Retry succeeds after reconnect
- ✅ No orphaned UI state

### Test 6.6: Large Document Sets

**Steps:**
1. Upload 100+ documents to a folder
2. Test scrolling and selection
3. Bulk move all documents

**Expected Results:**
- ✅ Smooth scrolling performance
- ✅ Select all works correctly
- ✅ Bulk operations complete successfully
- ✅ No UI freezing or lag

---

## Phase 7: Search & Filtering

### Test 7.1: Search Documents

**Steps:**
1. Enter search term in search box
2. Observe filtered results
3. Clear search

**Expected Results:**
- ✅ Results update as you type
- ✅ Search is case-insensitive
- ✅ Empty state shows if no matches
- ✅ Clear search button appears
- ✅ Search respects folder filter

### Test 7.2: Search Within Folder

**Steps:**
1. Select specific folder
2. Enter search term
3. Observe results only from that folder

**Expected Results:**
- ✅ Only documents in selected folder searched
- ✅ Document count reflects filtered results
- ✅ Context shows "X documents in [Folder Name]"

### Test 7.3: Search Empty Results

**Steps:**
1. Search for non-existent term
2. Observe empty state

**Expected Results:**
- ✅ Empty state specific to search (not general empty state)
- ✅ Message: "No documents match your search"
- ✅ "Clear Search" button appears
- ✅ Original results restored on clear

---

## Phase 8: Visual & UX Polish Verification

### Test 8.1: Loading States

**Verify:**
- ✅ Spinner shown while loading documents
- ✅ Loading message displayed
- ✅ Smooth transition from loading to content
- ✅ No flash of empty state before loading

### Test 8.2: Empty States

**Verify each variation:**
- ✅ No folders yet (with prompt to create)
- ✅ No documents yet (with upload button)
- ✅ Empty folder (with drag prompt)
- ✅ No search results (with clear button)

### Test 8.3: Animations & Transitions

**Verify:**
- ✅ Smooth drag animations
- ✅ Folder expand/collapse transitions
- ✅ Hover states on all interactive elements
- ✅ Selection visual feedback
- ✅ Toast notifications animate in/out

### Test 8.4: Responsive Design

**Test at different viewport sizes:**
- ✅ Desktop (1920x1080)
- ✅ Laptop (1366x768)
- ✅ Tablet (768x1024)
- ✅ Mobile (375x667)

**Verify:**
- ✅ Sidebar toggles or stacks on mobile
- ✅ Document grid adjusts columns
- ✅ Touch interactions work on mobile
- ✅ No horizontal scrolling

### Test 8.5: Accessibility

**Verify:**
- ✅ All interactive elements keyboard accessible
- ✅ Focus indicators visible
- ✅ Screen reader labels present
- ✅ ARIA attributes correct
- ✅ Color contrast meets WCAG AA

---

## Performance Benchmarks

### Folder Operations
- Create folder: < 200ms
- Rename folder: < 150ms
- Delete folder: < 200ms
- Load folder tree: < 300ms

### Document Operations
- Load documents: < 500ms (for 100 docs)
- Move document: < 200ms
- Bulk move (50 docs): < 1s

### Drag & Drop
- Drag start: Immediate (< 16ms)
- Drop operation: < 300ms
- Visual feedback: 60fps

---

## Regression Testing Checklist

After any changes, verify:

- [ ] All folder CRUD operations work
- [ ] Document assignment to folders works
- [ ] Drag & drop functionality intact
- [ ] Bulk operations functional
- [ ] Search and filtering work correctly
- [ ] Multi-tenancy isolation maintained
- [ ] Empty states display correctly
- [ ] Loading states appear appropriately
- [ ] Toast notifications shown
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] All API endpoints return correct status codes

---

## Test Data Cleanup

After testing, clean up test data:

```sql
-- Delete test folders (cascades to documents via ON DELETE)
DELETE FROM folder
WHERE organization_id = '75e3e9e7-c942-46a8-a815-4261f087aa11'
AND name LIKE 'Test%';

-- Delete test documents
DELETE FROM document
WHERE organization_id = '75e3e9e7-c942-46a8-a815-4261f087aa11'
AND title LIKE 'test%';
```

```cypher
// Delete test episodes from Neo4j
MATCH (e:Episode)
WHERE e.group_id = "75e3e9e7-c942-46a8-a815-4261f087aa11"
AND e.name CONTAINS "Test"
DELETE e
```

---

## Issue Reporting

If you encounter issues, report with:

1. **Steps to reproduce**
2. **Expected behavior**
3. **Actual behavior**
4. **Screenshots** (if UI issue)
5. **Browser console errors**
6. **Network tab errors** (for API issues)
7. **Database state** (relevant SQL queries)

---

## Success Criteria

All tests must pass with:
- ✅ No data corruption
- ✅ No security vulnerabilities
- ✅ Acceptable performance (< 1s for most operations)
- ✅ Proper error handling
- ✅ Clean user experience
- ✅ Multi-tenant isolation enforced
