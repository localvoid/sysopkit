/**
 * @module systemd
 *
 * This module provides operations for managing systemd services, units, and various systemd daemon
 * configurations.
 */

export {
  SYSTEMD_SYSTEM_PATH,
  SYSTEMD_USER_PATH,
  type SystemdScope,
  type SystemdScopeOptions,
  getSystemdConfigDropInPath,
  getSystemdConfigPath,
  getUnitPath,
} from './systemd/common.js';
export { type CoredumpConf } from './systemd/coredump.js';
export {
  type JournalRead,
  type JournalVacuumOptions,
  journalRead,
  journalVacuum,
} from './systemd/journal.js';
export { type JournaldConf } from './systemd/journald.js';
export { LOGIND_CONF_PATH, type LogindConf } from './systemd/logind.js';
export { daemonReload } from './systemd/manager.js';
export {
  RESOLVED_CONF_PATH,
  type ResolvedConf,
  type ResolvedLinkConf,
} from './systemd/resolved.js';
export {
  type GetServiceInfoOptions,
  type ServiceInfo,
  type ServiceOptions,
  getServiceInfo,
  enableService,
  disableService,
  startService,
  stopService,
  restartService,
  reloadService,
} from './systemd/service.js';
export { SLEEP_CONF_PATH, type SleepConf } from './systemd/sleep.js';
export {
  type SetHostnameOptions,
  type SetLocaleOptions,
  type SetTimezoneOptions,
  setHostname,
  setLocale,
  setTimezone,
} from './systemd/system.js';
export {
  type SysusersConf,
  type SysusersEntry,
  type SysusersType,
  parseSysusersConf,
  serializeSysusersConf,
} from './systemd/sysusers.js';
export { TIMESYNCD_CONF_PATH, type TimesyncdConf } from './systemd/timesyncd.js';
export {
  type TmpFilesConf,
  type TmpFilesEntry,
  type TmpfilesType,
  parseTmpFilesConf,
  serializeTmpFilesConf,
} from './systemd/tmpfiles.js';
export type {
  AutomountSectionOptions,
  AutomountUnitConf,
  BindIPv6Only,
  DeviceUnitConf,
  InstallSectionOptions,
  MountSectionOptions,
  MountUnitConf,
  OomPolicy,
  PathSectionOptions,
  PathUnitConf,
  ScopeSectionOptions,
  ScopeUnitConf,
  ServiceExitType,
  ServiceNotifyAccess,
  ServiceRestart,
  ServiceRestartMode,
  ServiceSectionOptions,
  ServiceType,
  ServiceUnitConf,
  SliceSectionOptions,
  SliceUnitConf,
  SocketProtocol,
  SocketSectionOptions,
  SocketTimestamping,
  SocketUnitConf,
  TargetUnitConf,
  TimeoutFailureMode,
  TimerSectionOptions,
  TimerUnitConf,
  UnitConf,
  UnitSectionOptions,
  UnitType,
} from './systemd/unit.js';
export type {
  NetworkConf,
  NetworkAddress,
  NetworkBridgePort,
  NetworkDHCPPrefixDelegation,
  NetworkDHCPServer,
  NetworkDHCPServerStaticLease,
  NetworkDHCPv4,
  NetworkDHCPv6,
  NetworkIPv6AcceptRA,
  NetworkIPv6AddressLabel,
  NetworkIPv6PREF64Prefix,
  NetworkIPv6Prefix,
  NetworkIPv6RoutePrefix,
  NetworkIPv6SendRA,
  NetworkLink,
  NetworkMatch,
  NetworkNeighbor,
  NetworkNetwork,
  NetworkNextHop,
  NetworkRoute,
  NetworkRoutingPolicyRule,
  NetworkSRIOV,
} from './systemd/networkd/network.js';
export type {
  NetDevConf,
  NetDevBAREUDP,
  NetDevBatmanAdvanced,
  NetDevBond,
  NetDevBridge,
  NetDevFooOverUDP,
  NetDevGENEVE,
  NetDevHSR,
  NetDevIPOIB,
  NetDevIPVLAN,
  NetDevIPVTAP,
  NetDevL2TP,
  NetDevL2TPSession,
  NetDevMACVLAN,
  NetDevMACVTAP,
  NetDevMACsec,
  NetDevMACsecReceiveAssociation,
  NetDevMACsecReceiveChannel,
  NetDevMACsecTransmitAssociation,
  NetDevMatch,
  NetDevNetDev,
  NetDevPeer,
  NetDevTap,
  NetDevTun,
  NetDevTunnel,
  NetDevVLAN,
  NetDevVRF,
  NetDevVXCAN,
  NetDevVXLAN,
  NetDevWLAN,
  NetDevWireGuard,
  NetDevWireGuardPeer,
  NetDevXfrm,
} from './systemd/networkd/netdev.js';
export type {
  LinkEnergyEfficientEthernet,
  LinkLink,
  LinkMatch,
  LinkSRIOV,
} from './systemd/networkd/link.js';
