---
description: "通过 pluginManager Remote 服务向客户端提供本地插件生命周期和已验证市场操作。"
kind: "package-reference"
---

# @deepseek-ai/dsh-host-plugin-manager

[English](README.md) | 中文

## 概述

本包让客户端通过 `pluginManager` 列出、安装、激活、停用和移除插件。它为设置界面组合本地注册表和已配置市场。Remote 客户端应使用它，而不是直接导入宿主注册表。

## 模型体验

### Remote 插件管理

#### 模型看到什么

`pluginManager` 不注册提示词、工具 schema 或直接模型结果；客户端负责任何模型可见呈现。

#### Token 影响

直接 Token 影响为零。

#### KV Cache 影响

独立于模型请求；本包不改变请求前缀。

## 已知限制与延期工作

- **客户端介导操作** — 本包不提供独立用户界面或授权策略；调用方必须提供两者。
