# Code Prism

## 🔗 What is it?

**Code Prism extension** is a tool that can record and store various information generated during code analysis.

When we analyze the code, many meta-data could occur, such as summary of what we analyzed, what to do, additional requests, related documents and so on. These metadata could be written and stored in a separate file, but keeping these meta-data as a separate file is very cumbersome and, above all, very inefficient because meta-data and code are not interconnected.

This extension is for these cases, _this extension manage these meta-data associated with code without modifying the code._

In fact, Code Prism is not just for source code, it is for all documents. so it allows you to leave the necessary comments on all kinds of documents(.md, .json, etc.) as well as the source code

Code Prism is basically a code review program. but it's simple to use and includes useful features for code analysis.

**_Enjoy!_**

![demo](./assets/code-prism-demo.gif)

## 🔗 Concept

The prism file and the document correspond one-to-one, and one prism file may contain multiple `Issue`s.

`Issue` is opinions on specific parts of the document. Therefore, `Issue` is linked to specific parts of the document and can have multiple `Note`s.

`Note` is opinion and information, it can be simple text, link, image, video and document.

## 🔗 Features

- Manage information associated with a specific part of the document without changing the source.
- Automatically displays definition information for the symbol at the current cursor position.
- Language independent. Works in any language that supports hovers.
- Supports syntax highlighting and markdown rendering in the docs view.

## 🔗 Release Notes

### 1.0.7

changed the extension's icon

### 1.0.6

changed the extension's icon

### 1.0.5

1. fix the bug that is malfunction of cancel button when input issue in comment controller.
2. implement to show the link information when comment is shown in comment controller.
3. and so on

---

## 💚 Code Prism is base of 💚

- [Docs View](https://marketplace.visualstudio.com/items?itemName=bierner.docs-view)
- [Definition View](https://marketplace.visualstudio.com/items?itemName=stevepryde.definition-view)
- [Code Explorer](https://marketplace.visualstudio.com/items?itemName=tianjianchn.code-explorer)
- [Project Notes](https://marketplace.visualstudio.com/items?itemName=willasm.pnotes)

## 🔗 Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## 🔗 For more information

- [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)
