---
description: "Expose installed-plugin lifecycle and verified marketplace actions through the pluginManager Remote service."
kind: "package-reference"
---

# @deepseek-ai/dsh-host-plugin-manager

English | [中文](README.zh.md)

## Summary

This package lets a client list, install, activate, deactivate, and remove plugins through `pluginManager`. It combines the local registry with the configured marketplace for settings surfaces. Use it for Remote clients rather than importing the host registry directly.

## Model Experience

### Remote plugin management

#### What the model sees

`pluginManager` registers no prompt, tool schema, or direct model result; its clients own any model-visible rendering.

#### Token effect

Zero direct token effect.

#### KV Cache effect

Independent of model requests; this package changes no request prefix.

## Known Limitations and Deferred Work

- **Client-mediated operations** — this package exposes no independent user interface or authorization policy; its caller must provide both.
