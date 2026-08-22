# Home SOC Lab

A self-hosted, hands-on security monitoring lab: an isolated attacker/target
network, a Wazuh SIEM, custom-written detection rules mapped to MITRE
ATT&CK, automated active response, and a custom live console built on top
of the Wazuh API.

Built to go beyond "installed a SIEM with default rules" — this project
focuses on writing and debugging real detection logic, and closing the
loop from detection to automated defense.

![Architecture diagram](architecture-diagram.svg)

## What it does

1. **Kali** launches real attacks (SSH brute-force via Hydra, SQL injection
   against a DVWA instance) against an isolated lab network.
2. A **Wazuh agent** on the monitored host ships logs (auth, syscall, web
   access logs) to the **Wazuh manager**.
3. The manager applies both Wazuh's default ruleset and **custom-written
   decoders/rules** to detect specific attack patterns.
4. On a confirmed brute-force, **Active Response** automatically blocks the
   attacker's IP via `iptables` — no human in the loop.
5. Alerts are queryable via the Wazuh dashboard, and also surface in a
   **custom-built React console** that polls the Wazuh indexer directly.

## Highlights

- **Custom detection engineering, not just default rules.** Wrote a Wazuh
  rule (building on the built-in `web-accesslog` decoder) that flags SQL
  injection attempts in DVWA request URLs, mapped to **MITRE ATT&CK T1190
  (Exploit Public-Facing Application)**. Debugged and verified with
  `wazuh-logtest` before confirming it live against real attack traffic.
- **Automated response, not just alerting.** Configured Wazuh Active
  Response so a detected SSH brute-force (rule 5712) automatically
  firewalls the attacker's IP on the target host, with an auto-expiring
  timeout.
- **A dashboard built from scratch**, not just Wazuh's UI: a small
  dependency-free Node proxy plus a React (via CDN, no build step) live
  console, querying the Wazuh indexer's REST API directly and rendering
  severity-coded live alerts.
- **A real, isolated lab network** — VirtualBox host-only networking, four
  VMs (attacker, two targets, SIEM), with attention paid to keeping the
  lab genuinely isolated from the host network while still being usable.

## Architecture

| Component | Role | IP |
|---|---|---|
| Kali Linux | Attacker | 192.168.56.10 |
| Metasploitable2 | Legacy network-level attack target | 192.168.56.20 |
| Wazuh (manager + indexer + dashboard) | SIEM | 192.168.56.30 |
| Ubuntu Server 26.04 | Monitored host (Wazuh agent + DVWA via Docker) | 192.168.56.40 |

Metasploitable2 is 32-bit and incompatible with modern Wazuh agent
packages, so it's used purely as a network-level target (port scans,
exploit attempts) while the monitored/agent-covered host is a separate,
modern Ubuntu Server VM — a deliberate design decision, not an oversight.

## Repository contents

```
├── architecture-diagram.svg
├── wazuh-config/
│   ├── decoders/local_decoder.xml   # not used in the final SQLi rule -
│   │                                 # kept as an example of an earlier
│   │                                 # approach; see README notes below
│   └── rules/local_rules.xml        # the working custom SQLi detection rule
└── dashboard/
    ├── server.js                    # Node proxy (no dependencies)
    ├── public/index.html            # React (CDN) live console
    └── README.md                    # dashboard-specific setup instructions
```

## Example: the custom SQLi detection rule

```xml
<group name="local,">
  <rule id="100011" level="12">
    <if_sid>31100</if_sid>
    <url>%27|OR(%20|\+)|UNION|SELECT|DROP</url>
    <description>Possible SQL Injection attempt detected against DVWA.</description>
    <mitre>
      <id>T1190</id>
    </mitre>
    <group>web,sql_injection,attack,</group>
  </rule>
</group>
```

This builds on Wazuh's built-in `web-accesslog` decoder (rule `31100`)
rather than a custom decoder — an early attempt at a fully custom decoder
worked in isolation but never matched in practice, since Wazuh's own
built-in decoder was already claiming the log line first. Debugging that
mismatch (using `wazuh-logtest` to see exactly which decoder/rule fired)
was as much a part of this project as the working config.

## Setup

Full step-by-step VM/network setup isn't reproduced here since it's fairly
environment-specific (VirtualBox host-only networking, static IP
configuration per VM). At a high level:

1. Create an isolated VirtualBox host-only network.
2. Deploy Kali, Metasploitable2, the official Wazuh OVA, and a fresh Ubuntu
   Server VM, all attached to that network.
3. Install the Wazuh agent on the Ubuntu Server VM, pointed at the Wazuh
   manager.
4. Deploy DVWA via Docker on the Ubuntu Server VM with its Apache logs
   volume-mounted to the host, then point the Wazuh agent's `localfile`
   config at that log.
5. Add the custom rule from `wazuh-config/rules/local_rules.xml` to the
   manager's `/var/ossec/etc/rules/local_rules.xml`.
6. Configure Active Response in the manager's `ossec.conf` (see below).

### Active Response config (manager `ossec.conf`)

```xml
<command>
  <name>firewall-drop</name>
  <executable>firewall-drop</executable>
  <timeout_allowed>yes</timeout_allowed>
</command>

<active-response>
  <command>firewall-drop</command>
  <location>local</location>
  <rules_id>5712</rules_id>
  <timeout>120</timeout>
</active-response>
```

### Running the custom dashboard

See `dashboard/README.md`.

## What's next

- Suricata network IDS layer, to detect network-level reconnaissance
  (port scans) that a host-based agent can't see.
- Additional custom rules for other DVWA vulnerability classes (XSS,
  command injection).

## Notes on scope

Everything in this repo runs on an isolated, host-only virtual network
with no route to the internet or any production system. It's a personal
learning lab, not a deployment guide for production security tooling.