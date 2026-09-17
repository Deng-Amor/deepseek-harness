---
description: "Manage installed and marketplace plugins from the Web Settings Plugins tab."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-plugin-manager

English | [中文](README.zh.md)

## Summary

This Settings tab lets Web users inspect installed plugins and request installation, activation, deactivation, or removal. It also searches the configured marketplace. Use it when the Web client mounts the Plugins settings section; all operations require the host `pluginManager` Remote.

## Model Experience

### Browser plugin management UI

#### What the model sees

`PluginManagerSettingsTab` registers no prompt, tool schema, or direct model result; the host Remote and its callers own any model-visible rendering.

#### Token effect

Zero direct token effect.

#### KV Cache effect

Independent of model requests; this package changes no request prefix.

## Known Limitations and Deferred Work

- **No offline workflow** — the tab depends on a reachable host Remote and does not queue lifecycle operations for later delivery.
