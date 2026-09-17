---
description: "在 Web 设置的插件标签页中管理已安装插件和市场插件。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-plugin-manager

[English](README.md) | 中文

## 概述

此设置标签页让 Web 用户查看已安装插件，并请求安装、激活、停用或移除。它也会搜索已配置的市场。适用于 Web 客户端挂载插件设置区；所有操作都需要宿主 `pluginManager` Remote。

## 模型体验

### 浏览器插件管理界面

#### 模型看到什么

`PluginManagerSettingsTab` 不注册提示词、工具 schema 或直接模型结果；宿主 Remote 和调用方负责任何模型可见呈现。

#### Token 影响

直接 Token 影响为零。

#### KV Cache 影响

独立于模型请求；本包不改变请求前缀。

## 已知限制与延期工作

- **没有离线流程** — 该标签页依赖可访问的宿主 Remote，且不会将生命周期操作排队到以后交付。
