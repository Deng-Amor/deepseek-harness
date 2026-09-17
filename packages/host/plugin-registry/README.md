---
description: "Install, activate, deactivate, and persist local DSH plugin packages through the host plugin registry."
kind: "package-reference"
---

# @deepseek-ai/dsh-plugin-registry

English | [中文](README.zh.md)

## Summary

This package keeps locally installed plugins available across host restarts. It installs archives or GitHub repositories, activates host entries through the Loader, and preserves plugin configuration. Use it when a host needs mutable local plugin packages; the registry trusts the package content it installs.

## Model Experience

### Plugin lifecycle operations

#### What the model sees

`PluginRegistry` registers no prompt, tool schema, or direct model result; callers own any model-visible rendering of plugin lifecycle operations.

#### Token effect

Zero direct token effect.

#### KV Cache effect

Independent of model requests; this package changes no request prefix.

## Known Limitations and Deferred Work

- **Trusted local execution** — installed plugin hooks and host entries run with host authority; the registry does not sandbox or audit package code.
