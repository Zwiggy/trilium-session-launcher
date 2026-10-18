# Trilium Session Launcher

A quick-launch menu and template manager for [Trilium Notes](https://github.com/zadam/trilium). It provides a front-end overlay to rapidly create formatted notes, journal entries, and templates in targeted folders directly from a popup dialog.

![Session Launcher Main Menu](main-menu.png)

## Features

* **Native Boxicon Picker:** Access Trilium's built-in library of 1,600+ Boxicons natively without external dependencies.
* **Fuzzy Search:** Filter templates, destination folders, and icons automatically while ignoring spaces and accents.
* **Rich Text Template Editor:** Built-in WYSIWYG editor supporting custom headers, lists, bolding, colors, and background highlights.
* **Dynamic Variables:** Inject `{{date}}`, `{{time}}`, or custom `{{prompt:Variable Name}}` tags that prompt for values upon creation.
* **Automated Sync & Backups:** Configuration auto-saves to `_Session Launcher Config_`. Importing new configurations creates a timestamped backup automatically.
* **Drag-and-Drop Ordering:** Reorder template buttons on the fly using the left drag handle.
* **Full Keyboard Navigation:** Navigate using `↑` / `↓` arrow keys, press `Enter` to launch, and `Esc` to close.

---

## Installation

1. Open your Trilium workspace.
2. Create a new Note and set the title to `Session Launcher`.
3. Set the Note Type to **JS Frontend**.
4. Paste the contents of `session-launcher.js` into the note editor.
5. Add the label attribute `#run=front` to the note.

*Tip: Assign a keybinding to this note in Trilium's shortcut settings, or add it to your launcher bar for single-click access.*

## Usage & Controls

| Action | Control / UI Element |
| :--- | :--- |
| **Navigate List** | `↑` / `↓` Arrow keys |
| **Launch Selected** | `Enter` key or click item row |
| **Close Menu** | `Esc` key or **Close** button |
| **Reorder Item** | Drag the left grip handle (`:::`) |
| **Edit Item** | Pencil icon (`✏️`) |
| **Change Folder** | Gear icon (`⚙️`) |
| **Duplicate Item** | Copy icon (`📋`) |
| **Delete Item** | Trash icon (`🗑️`) |
| **Export Config** | **↑** button at bottom right |
| **Import Config** | **↓** button at bottom right |

---

## Screenshots

### 1. Main Menu
The primary quick-launch overlay listing active templates and destination folders.

![Main Menu](main-menu.png)

### 2. Template Creation & Editing
Customize template buttons, icons, default attributes, and rich text content.

#### Edit Template
![Edit Template Dialog](template-editor.png)

#### New Template
![New Template Dialog](new-template.png)

### 3. Destination Selection
Search and assign target folder destinations by folder title or Note ID.

#### Find Destination Input
![Find Destination Input](destination-picker.png)

#### Search Results
![Destination Search Results](destination-picker-results.png)

### 4. Launch & Note Creation
Review titles, substitute dynamic variables, and generate formatted notes directly in your workspace.

#### Launch Confirmation
![Launch Dialog](launch-dialog.png)

#### Formatted Generated Note
![Created Note](created-note.png)

### 5. Backup & Configuration Management
Safely export or import JSON configurations with automated backup creation.

#### Export Configuration
![Export Configuration](export-dialog.png)

#### Import Configuration
![Import Configuration](import-dialog.png)

#### Delete Confirmation
![Delete Confirmation](delete-confirm.png)

---

## License

[MIT License](LICENSE)
