---
description: "通过宿主插件注册表安装、激活、停用并持久化本地 DSH 插件包。"
kind: "package-reference"
---

# @deepseek-ai/dsh-plugin-registry

[English](README.md) | 中文

## 概述

本包让本地安装的插件在宿主重启后仍可使用。它安装归档或 GitHub 仓库，通过 Loader 激活宿主条目，并保存插件配置。适用于需要可变本地插件包的宿主；注册表信任其安装的包内容。

## 模型体验

### 插件生命周期操作

#### 模型看到什么

`PluginRegistry` 不注册提示词、工具 schema 或直接模型结果；调用方负责插件生命周期操作的任何模型可见呈现。

#### Token 影响

直接 Token 影响为零。

#### KV Cache 影响

独立于模型请求；本包不改变请求前缀。

## 已知限制与延期工作

- **可信本地执行** — 已安装的插件 hook 和宿主条目以宿主权限运行；注册表不沙箱化或审计包代码。
