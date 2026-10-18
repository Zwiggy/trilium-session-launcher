# Trilium Session Launcher

A quick-launch menu and template manager for [Trilium Notes](https://github.com/zadam/trilium). It provides a front-end UI to rapidly generate formatted notes, journal entries, and templates in specific folders directly from a popup dialog.

![Session Launcher Main Menu](image_ca76a6.png)

## Features

* **Native Boxicon Picker:** Access Trilium's built-in library of Boxicons natively. No external web dependencies or SVGs required.
* **Fuzzy Search:** Filter templates, destination folders, and icons. The search ignores spaces and special characters.
* **Rich Text Template Editor:** Format note templates with a built-in editor. Supports text color, highlighting, lists, and headers.
* **Dynamic Variables:** Insert `{{date}}`, `{{time}}`, or custom `{{prompt:Variable Name}}` tags into your templates. The launcher prompts for these values upon note creation.
* **Automated Backups:** Importing a new configuration automatically generates a timestamped backup note in your root directory.
* **Drag-and-Drop Organization:** Reorder launcher buttons using the left grip handle.
* **Keyboard Navigation:** Navigate the menu using `↑` and `↓` arrow keys, press `Enter` to launch, and `Esc` to close.
* **Zero External Dependencies:** Built entirely with standard JS/HTML/CSS and Trilium's native API.

## Installation

1. Open your Trilium workspace.
2. Create a new Note and name it `Session Launcher`.
3. Set the Note Type to **JS Frontend**.
4. Paste the contents of `session-launcher.js` into the editor.
5. Add the label `#run=front` to the note's attributes.

*Tip: Assign a keyboard shortcut to this note via Trilium's native shortcut manager, or place it on your quick-access bar for instant access.*

## Usage

* **Manage Templates:** Use the **+ New Template** button to create a configuration. On existing rows, use the gear icon to change the destination folder, the pencil icon to edit, the copy icon to duplicate, or the trash icon to delete.
* **Configuration Sync:** The plugin automatically creates a backend configuration note (`_Session Launcher Config_`) in your root directory to save your templates. 
* **Import/Export:** Use the **↑** (Export) and **↓** (Import) arrow buttons at the bottom of the menu to back up your setup or share it across different workspaces as JSON data.