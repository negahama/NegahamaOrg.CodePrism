# Change Log

All notable changes to the "Code Prism" extension will be documented in this file.

<!-- ### version - Month day, year -->

### 1.4.0 - November 10, 2024

1. implement 1 + 1 link
2. implement the feature that generate mermaid diagram for all references
3. implement the features that are 'CodePrism.command.findReferences' and 'CodePrism.command.findImplementations'
4. I decided to include the results of the process of analyzing and developing the Code Prism using this Code Prism extension in the GitHub repository. so you can see more information about the Code Prism when you visit the [github repository](https://github.com/negahama/NegahamaOrg.CodePrism.git)

### 1.3.3 - November 8, 2024

changed url of screen shot images

### 1.3.2 - November 7, 2024

bugs fix

- fixed the bug that don't delete comments when the prism file is deleted
- fixed the bug that don't append new issue when prism tree view is list mode
- fixed the bug that don't change the category when prism tree view is list mode

add functions

- key binding
- copy code-anchor link
  this function is useful when you want to link code's specific part.
  you can use it by context menu and pressing Ctrl+Alt+C Ctrl+Alt+C

### 1.3.1 - November 6, 2024

changed icon color and tooltip content of prism tree view and bug fix.

### 1.3.0 - November 6, 2024

1. appended new commands about finding and searching(eg. Find All Reference, Open Search Editor, and so on) in DefinitionView.
2. appended new PrismView's mode(Issue List Mode) and implemented sorting of tree item by name, category, created time.
3. appended the method of modifying note's category(you can changed the category when you write the comment)
4. improved some stuff of display and performance.
5. bug fixes.

### 1.2.0 - November 3, 2024

1. implement to cahnge issue's position
2. implement to change note's category
3. implement to make markdown file related the note

### 1.1.0 - October 31, 2024

> 🚨 This version is not compatible with the previous versions  
>  (if you need your data, please rename the `context` to `content` in all prism files in your prism folder(it is normally `<your project>.prism`) T.T)

- improve function about link in comment controller's comment

### 1.0.8 - October 31, 2024

- improve the link function

### 1.0.7 - October 30, 2024

- fix the bug that don't show the linked file's context in hover tooltip

### 1.0.6 - October 30, 2024

- changed the extension's icon

### 1.0.5 - October 30, 2024

1. fix the bug that is malfunction of cancel button when input issue in comment controller.
2. implement to show the link information when comment is shown in comment controller.
3. and so on

### 1.0.4 - October 29, 2024

- bug fixed : fixed the bug that couldn't search the documents relatived source code

### 1.0.0 - October 29, 2024

- Initial release
