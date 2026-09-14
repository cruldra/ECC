---
name: cisco-ios-patterns
description: Cisco IOS 与 IOS-XE 审查模式，涵盖 show 命令、配置层级、通配符掩码、ACL 放置位置、接口规范以及安全的变更窗口验证。在阅读、编写或审查 Cisco IOS / IOS-XE 配置或规划变更窗口时使用。
metadata:
  origin: community
  locale: zh-CN
locale: zh-CN
source_hash: 85b6a97574cc236d4a9336b1c74b42aaf4386338417e787cbed0c88677bf1179
translated_at: 2026-09-14T07:39:01Z
model: z-ai/glm-5.3-flash
---

# Cisco IOS 模式

在审查 Cisco IOS 或 IOS-XE 配置片段、构建变更窗口检查清单，或解释如何在不使事故恶化的前提下从路由器或交换机收集证据时，使用本技能。

## 何时使用

- 在计划变更之前审查 IOS 或 IOS-XE 配置。
- 选择用于故障排查的只读 `show` 命令。
- 检查 ACL 通配符掩码和接口方向。
- 解释全局、接口、路由进程和线路配置模式。
- 验证变更已进入 running config，并且是经过有意保存的。

## 操作规则

将 IOS 示例视为模式，而非可直接粘贴的生产变更。在真实设备上进行更改之前，确认平台、接口名称、当前配置、回滚路径和带外访问方式。

推荐的工作流程：

1. 使用只读命令捕获当前状态。
2. 审查确切的候选配置。
3. 确认管理访问不会被锁死。
4. 在维护窗口内应用最小变更。
5. 重新读取状态并与基线比较，验证通过后才保存。

## 模式参考

```text
Router> enable
Router# show running-config
Router# configure terminal
Router(config)# interface GigabitEthernet0/1
Router(config-if)# description UPLINK-TO-CORE
Router(config-if)# no shutdown
Router(config-if)# exit
Router(config)# end
Router# show running-config interface GigabitEthernet0/1
```

`running-config` 是活动内存中的配置。`startup-config` 是重启后仍然存在的配置。
不要仅仅因为命令被接受就保存变更；先验证行为，变更获得批准后再使用 `copy running-config startup-config`。

## 只读信息收集

```text
show version
show inventory
show processes cpu sorted
show memory statistics
show logging
show running-config | section line vty
show running-config | section interface
show running-config | section router bgp
show ip interface brief
show interfaces
show interfaces status
show vlan brief
show mac address-table
show spanning-tree
show ip route
show ip protocols
show ip access-lists
show route-map
show ip prefix-list
```

当配置中可能包含机密、客户名称或私有拓扑信息时，只收集所需的特定部分，而不是将完整配置倾倒到工单中。

## 通配符掩码

IOS ACL 和许多路由语句使用的是通配符掩码，而不是子网掩码。

```text
子网掩码           通配符掩码
255.255.255.255   0.0.0.0
255.255.255.252   0.0.0.3
255.255.255.0     0.0.0.255
255.255.0.0       0.0.255.255
```

部署前务必审查通配符掩码。如果误将子网掩码当作通配符掩码使用，可能会匹配到远超预期的流量。

```text
ip access-list extended WEB-IN
  10 permit tcp 192.0.2.0 0.0.0.255 any eq 443
  999 deny ip any any log
```

每个 ACL 末尾都有一个隐式 deny。当运维目标包括观察未命中的情况时，应添加显式的、带日志记录的 deny，并确认日志量处于安全水平。

## ACL 放置位置审查

将 ACL 应用到接口之前，回答以下问题：

- 正在过滤的流量方向是哪个，`in` 还是 `out`？
- 管理流量是否来自已知的跳板机或管理子网？
- 对于所需的路由、DNS、NTP、监控或应用流量，是否有显式的 permit？
- 是否可以从安全的测试源获取命中计数器？
- 是否有回滚命令，以及可用的活跃控制台或带外访问路径？

不要通过移除防火墙或 ACL 保护来测试可达性。先读取计数器、日志和路由状态。

## 接口规范

```text
interface GigabitEthernet0/1
 description UPLINK-TO-CORE
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30
 switchport trunk native vlan 999
 no shutdown
```

使用清晰的描述、显式的 switchport 模式，以及有文档记录的 native VLAN。在路由接口上，在假设链路状态等同于转发正确之前，先确认掩码、对端编址和路由进程。

## 变更窗口验证

使用与实际变更相匹配的变更前/后检查。

```text
show running-config | section interface GigabitEthernet0/1
show interfaces GigabitEthernet0/1
show logging | include GigabitEthernet0/1|changed state|line protocol
show ip route <prefix>
show ip access-lists <name>
```

对于路由变更，还应捕获变更前后的邻居状态和路由表。对于 ACL 变更，应从计划的测试源比较命中计数器，而不是依赖普通的 ping。

## 反模式

- 在没有设备特定 diff 的情况下直接应用生成的配置。
- 在变更后检查通过之前就保存配置。
- 在 IOS 需要通配符掩码的地方使用子网掩码。
- 将 ACL 应用到错误的接口方向。
- 通过禁用 ACL、路由策略或身份验证来进行故障排查。
- 在未对机密和拓扑进行脱敏的情况下，将完整配置粘贴到公开工具中。

## 另请参阅

- Agent：`network-config-reviewer`
- Agent：`network-troubleshooter`
- Skill：`network-config-validation`
- Skill：`network-interface-health`