/**
 * @module systemd/unit
 *
 * Systemd unit file management operations.
 *
 * @see systemd.unit(5) - Unit configuration
 * @see systemd.service(5) - Service units
 * @see systemd.timer(5) - Timer units
 * @see systemd.socket(5) - Socket units
 * @see systemd.mount(5) - Mount units
 * @see systemd.automount(5) - Automount units
 * @see systemd.path(5) - Path units
 * @see systemd.slice(5) - Slice units
 * @see systemd.resource-control(5) - Resource control settings
 * @see systemctl(1) - Control the systemd system and service manager
 *
 * Unit files are written to:
 * - System: /etc/systemd/system/
 * - User: ~/.config/systemd/user/
 */

/**
 * Supported unit types.
 */
export type UnitType =
  | 'service'
  | 'timer'
  | 'socket'
  | 'mount'
  | 'device'
  | 'target'
  | 'path'
  | 'slice'
  | 'scope'
  | 'automount';

/**
 * Options for the [Unit] section of any systemd unit file.
 *
 * @see systemd.unit(5)
 */
export type UnitSectionOptions = {
  /** Human-readable description of the unit. */
  Description?: string;

  /** Space-separated list of documentation URIs (http, https, file, man, info). */
  Documentation?: string;

  /** Weak requirement: listed units are started alongside this one. */
  Wants?: string;

  /** Strong requirement: if listed units fail to start, this unit fails. */
  Requires?: string;

  /** Like Requires=, but fails immediately if units are not already started. */
  Requisite?: string;

  /** Stronger than Requires=; this unit stops when the bound unit stops. */
  BindsTo?: string;

  /** Propagates stop/restart to this unit when the listed unit stops/restarts. */
  PartOf?: string;

  /** Continuously restarts listed units while this unit is active. */
  Upholds?: string;

  /** Negative dependency: starting one stops the other. */
  Conflicts?: string;

  /** Ordering: this unit starts before the listed units. */
  Before?: string;

  /** Ordering: this unit starts after the listed units. */
  After?: string;

  /** Units activated when this unit enters "failed" state. */
  OnFailure?: string;

  /** Units activated when this unit enters "inactive" state. */
  OnSuccess?: string;

  /** Propagate reload requests to these units. */
  PropagatesReloadTo?: string;

  /** Receive reload requests from these units. */
  ReloadPropagatedFrom?: string;

  /** Propagate stop requests to these units. */
  PropagatesStopTo?: string;

  /** Receive stop requests from these units. */
  StopPropagatedFrom?: string;

  /** Join network/tmp/IPC namespaces of listed units. */
  JoinsNamespaceOf?: string;

  /** Adds Requires= and After= for mount units needed to access these paths. */
  RequiresMountsFor?: string;

  /** Adds Wants= for mount units needed to access these paths. */
  WantsMountsFor?: string;

  /** Job mode for OnSuccess= units (default: "fail"). */
  OnSuccessJobMode?: string;

  /** Job mode for OnFailure= units (default: "replace"). */
  OnFailureJobMode?: string;

  /** If true, unit is not stopped when isolating another unit. */
  IgnoreOnIsolate?: 'yes' | 'no';

  /** If true, unit is stopped when no other unit requires it. */
  StopWhenUnneeded?: 'yes' | 'no';

  /** If true, explicit start is denied. */
  RefuseManualStart?: 'yes' | 'no';

  /** If true, explicit stop is denied. */
  RefuseManualStop?: 'yes' | 'no';

  /** If true, unit may be used with `systemctl isolate`. */
  AllowIsolate?: 'yes' | 'no';

  /** If true (default), implicit default dependencies are created. */
  DefaultDependencies?: 'yes' | 'no';

  /** If true, processes don't receive final SIGTERM/SIGKILL on shutdown. */
  SurviveFinalKillSignal?: 'yes' | 'no';

  /** When to collect the unit: "inactive" or "inactive-or-failed" (default: "inactive"). */
  CollectMode?: 'inactive' | 'inactive-or-failed';

  /** Action on failure: none, reboot, poweroff, reboot-force, poweroff-force, exit, exit-force, kexec, soft-reboot. */
  FailureAction?: string;

  /** Action on success: none, reboot, poweroff, reboot-force, poweroff-force, exit, exit-force, kexec, soft-reboot. */
  SuccessAction?: string;

  /** Exit status for exit/exit-force actions on failure. */
  FailureActionExitStatus?: number;

  /** Exit status for exit/exit-force actions on success. */
  SuccessActionExitStatus?: number;

  /** Timeout for the whole job (default: "infinity"). */
  JobTimeoutSec?: string;

  /** Timeout after job starts running. */
  JobRunningTimeoutSec?: string;

  /** Action on job timeout. */
  JobTimeoutAction?: string;

  /** Reboot argument for reboot actions on job timeout. */
  JobTimeoutRebootArgument?: string;

  /** Rate limiting interval (e.g., "10s", "1min"). */
  StartLimitIntervalSec?: string;

  /** Max starts per StartLimitIntervalSec window. */
  StartLimitBurst?: number;

  /** Action when rate limit is hit: none, reboot, reboot-force, poweroff, poweroff-force, exit, exit-force. */
  StartLimitAction?: string;

  /** Argument for reboot(2) system call. */
  RebootArgument?: string;

  /** Path to config file this unit was generated from. */
  SourcePath?: string;

  /** True if all listed paths exist. */
  ConditionPathExists?: string;

  /** True if all listed paths are directories. */
  ConditionPathIsDirectory?: string;

  /** True if all listed paths are symlinks. */
  ConditionPathIsSymbolicLink?: string;

  /** True if all listed paths are mount points. */
  ConditionPathIsMountPoint?: string;

  /** True if all listed paths are read-write. */
  ConditionPathIsReadWrite?: string;

  /** True if all listed directories are not empty. */
  ConditionDirectoryNotEmpty?: string;

  /** True if all listed files are not empty. */
  ConditionFileNotEmpty?: string;

  /** True if all listed files are executable. */
  ConditionFileIsExecutable?: string;

  /** True if kernel command line matches the given patterns. */
  ConditionKernelCommandLine?: string;

  /** True if kernel version matches the given patterns. */
  ConditionKernelVersion?: string;

  /** True if the specified security feature is available. */
  ConditionSecurity?: string;

  /** True if running in the specified virtualization environment. */
  ConditionVirtualization?: string;

  /** True if running on the specified architecture. */
  ConditionArchitecture?: string;

  /** True if hostname matches the given patterns. */
  ConditionHost?: string;

  /** True if on AC power (prefix with "!" to invert). */
  ConditionACPower?: 'yes' | 'no';

  /** True if the specified path needs an update. */
  ConditionNeedsUpdate?: string;

  /** True if this is the first boot. */
  ConditionFirstBoot?: 'yes' | 'no';

  /** True if any glob pattern matches any path. */
  ConditionPathExistsGlob?: string;

  /** True if running as the specified user(s). */
  ConditionUser?: string;

  /** True if running as the specified group(s). */
  ConditionGroup?: string;

  /** True if the specified cgroup controller is available. */
  ConditionControlGroupController?: string;

  /** True if memory size matches the specified range. */
  ConditionMemory?: string;

  /** True if CPU count matches the specified range. */
  ConditionCPUs?: string;

  /** True if the specified environment variable is set. */
  ConditionEnvironment?: string;

  /** True if the specified credential is set. */
  ConditionCredential?: string;

  /** Assert that all listed paths exist (fails unit if not). */
  AssertPathExists?: string;

  /** Assert that all listed paths are directories. */
  AssertPathIsDirectory?: string;

  /** Assert that kernel command line matches patterns. */
  AssertKernelCommandLine?: string;

  /** Assert running in specified virtualization. */
  AssertVirtualization?: string;

  /** Assert running on specified architecture. */
  AssertArchitecture?: string;
};

/**
 * Options for the [Install] section of any systemd unit file.
 *
 * @see systemd.unit(5)
 */
export type InstallSectionOptions = {
  /** Additional names for the unit (symlinks created on enable). */
  Alias?: string;

  /** Creates .wants/ symlinks from listed units when enabled. */
  WantedBy?: string;

  /** Creates .requires/ symlinks from listed units when enabled. */
  RequiredBy?: string;

  /** Enable/disable these units together with this unit. */
  Also?: string;

  /** Default instance for template units. */
  DefaultInstance?: string;
};

/**
 * Service type for Type= directive.
 */
export type ServiceType =
  | 'simple'
  | 'exec'
  | 'forking'
  | 'oneshot'
  | 'dbus'
  | 'notify'
  | 'notify-reload'
  | 'idle';

/**
 * Restart mode for Restart= directive.
 */
export type ServiceRestart =
  | 'no'
  | 'on-success'
  | 'on-failure'
  | 'on-abnormal'
  | 'on-watchdog'
  | 'on-abort'
  | 'always';

/**
 * Exit type for ExitType= directive.
 */
export type ServiceExitType = 'main' | 'cgroup';

/**
 * Notify access for NotifyAccess= directive.
 */
export type ServiceNotifyAccess = 'none' | 'main' | 'exec' | 'all';

/**
 * Restart mode for RestartMode= directive.
 */
export type ServiceRestartMode = 'normal' | 'direct' | 'debug';

/**
 * OOM policy for OOMPolicy= directive.
 */
export type OomPolicy = 'continue' | 'stop' | 'kill';

/**
 * Timeout failure mode.
 */
export type TimeoutFailureMode = 'terminate' | 'abort' | 'kill';

/**
 * Options for the [Service] section of a service unit file.
 *
 * @see systemd.service(5)
 */
export type ServiceSectionOptions = {
  /** Service execution type (default: "simple"). */
  Type?: ServiceType;

  /** What is considered the main process for exit status: "main" or "cgroup". */
  ExitType?: ServiceExitType;

  /** Consider service active even after all processes exit. */
  RemainAfterExit?: 'yes' | 'no';

  /** Try to guess the main PID (default: yes). */
  GuessMainPID?: 'yes' | 'no';

  /** Path to PID file (recommended for Type=forking). */
  PIDFile?: string;

  /** D-Bus destination name (mandatory for Type=dbus). */
  BusName?: string;

  /** Commands to execute when service starts (multiple allowed, space-separated). */
  ExecStart?: string;

  /** Commands executed before ExecStart. */
  ExecStartPre?: string;

  /** Commands executed after ExecStart. */
  ExecStartPost?: string;

  /** Optional pre-start condition commands (exit 1-254 skips, 255 fails). */
  ExecCondition?: string;

  /** Commands to trigger configuration reload. */
  ExecReload?: string;

  /** Commands after successful reload. */
  ExecReloadPost?: string;

  /** Commands to stop the service. */
  ExecStop?: string;

  /** Commands executed after service stops. */
  ExecStopPost?: string;

  /** Time to wait before restarting (default: "100ms"). */
  RestartSec?: string;

  /** Number of exponential backoff steps. */
  RestartSteps?: number;

  /** Max delay for exponential backoff. */
  RestartMaxDelaySec?: string;

  /** Max time for start-up. */
  TimeoutStartSec?: string;

  /** Max time for stop. */
  TimeoutStopSec?: string;

  /** Max time for abort after watchdog timeout. */
  TimeoutAbortSec?: string;

  /** Shorthand for both TimeoutStartSec and TimeoutStopSec. */
  TimeoutSec?: string;

  /** Mode on start timeout: "terminate", "abort", or "kill". */
  TimeoutStartFailureMode?: TimeoutFailureMode;

  /** Mode on stop timeout: "terminate", "abort", or "kill". */
  TimeoutStopFailureMode?: TimeoutFailureMode;

  /** Maximum runtime for the service. */
  RuntimeMaxSec?: string;

  /** Random extra runtime added to RuntimeMaxSec. */
  RuntimeRandomizedExtraSec?: string;

  /** Watchdog timeout; service must send keep-alive (default: 0=disabled). */
  WatchdogSec?: string;

  /** When to restart the service (default: "no"). */
  Restart?: ServiceRestart;

  /** Restart mode: "normal", "direct", or "debug". */
  RestartMode?: ServiceRestartMode;

  /** Exit codes/signals considered successful. */
  SuccessExitStatus?: string;

  /** Exit codes/signals that prevent restart. */
  RestartPreventExitStatus?: string;

  /** Exit codes/signals that force restart. */
  RestartForceExitStatus?: string;

  /** Apply RootDirectory only to ExecStart. */
  RootDirectoryStartOnly?: 'yes' | 'no';

  /** Set O_NONBLOCK on socket-activated FDs. */
  NonBlocking?: 'yes' | 'no';

  /** Which processes can send notifications: "none", "main", "exec", or "all". */
  NotifyAccess?: ServiceNotifyAccess;

  /** Socket units to inherit FDs from. */
  Sockets?: string;

  /** Max FDs to store (default: 0). */
  FileDescriptorStoreMax?: number;

  /** FD store preservation: "no", "yes", or "restart". */
  FileDescriptorStorePreserve?: string;

  /** Run service as specific UID. */
  UID?: string;

  /** Derive SELinux context from network peer. */
  SELlinuxContextFromNet?: 'yes' | 'no';

  /** OOM policy: "continue", "stop", or "kill". */
  OOMPolicy?: OomPolicy;

  /** Signal to send for reload (default: SIGHUP). */
  ReloadSignal?: string;

  /** Signal to send for termination (default: SIGTERM). */
  KillSignal?: string;

  /** Signal for restart (default: SIGTERM). */
  RestartKillSignal?: string;

  /** Final kill signal (default: SIGKILL). */
  FinalKillSignal?: string;

  /** Signal for watchdog timeout (default: SIGABRT). */
  WatchdogSignal?: string;

  /** CPU weight (1-10000, default: 100). */
  CPUWeight?: number;

  /** Memory high watermark (soft limit). */
  MemoryHigh?: string;

  /** Memory hard limit. */
  MemoryMax?: string;

  /** Maximum number of tasks. */
  TasksMax?: number | string;

  /** IO weight (1-10000, default: 100). */
  IOWeight?: number;

  /** CPU quota percentage (e.g., "50%" means half a CPU). */
  CPUQuota?: string;

  /** Memory limit (legacy, use MemoryMax). */
  MemoryLimit?: string;
};

/**
 * Complete service unit configuration.
 */
export type ServiceUnitConf = {
  Unit?: UnitSectionOptions;
  Service: ServiceSectionOptions;
  Install?: InstallSectionOptions;
};

/**
 * Options for the [Timer] section of a timer unit file.
 *
 * @see systemd.timer(5)
 */
export type TimerSectionOptions = {
  /** Timer relative to when timer unit itself is activated. */
  OnActiveSec?: string;

  /** Timer relative to machine boot. */
  OnBootSec?: string;

  /** Timer relative to service manager start. */
  OnStartupSec?: string;

  /** Timer relative to when activated unit was last activated. */
  OnUnitActiveSec?: string;

  /** Timer relative to when activated unit was last deactivated. */
  OnUnitInactiveSec?: string;

  /** Realtime timer with calendar event expression (e.g., "daily", "Mon *-*-* 00:00:00"). */
  OnCalendar?: string;

  /** Timer accuracy window (default: "1min"). */
  AccuracySec?: string;

  /** Random delay added to timer. */
  RandomizedDelaySec?: string;

  /** Use deterministic random delay. */
  FixedRandomDelay?: 'yes' | 'no';

  /** Stable random offset for OnCalendar timers. */
  RandomizedOffsetSec?: string;

  /** Schedule next elapse based on unit inactivity. */
  DeferReactivation?: 'yes' | 'no';

  /** Trigger on system clock change. */
  OnClockChange?: 'yes' | 'no';

  /** Trigger on timezone change. */
  OnTimezoneChange?: 'yes' | 'no';

  /** Unit to activate when timer elapses (default: same name minus .timer). */
  Unit?: string;

  /** Catch up on missed runs after downtime. */
  Persistent?: 'yes' | 'no';

  /** Wake system from suspend on timer elapse. */
  WakeSystem?: 'yes' | 'no';

  /** Keep timer loaded after elapse (default: yes). */
  RemainAfterElapse?: 'yes' | 'no';
};

/**
 * Complete timer unit configuration.
 */
export type TimerUnitConf = {
  Unit?: UnitSectionOptions;
  Timer: TimerSectionOptions;
  Install?: InstallSectionOptions;
};

// ---------------------------------------------------------------------------
// [Socket] section
// ---------------------------------------------------------------------------

/**
 * Socket protocol for SocketProtocol= directive.
 */
export type SocketProtocol = 'udplite' | 'sctp' | 'mptcp';

/**
 * BindIPv6Only options.
 */
export type BindIPv6Only = 'default' | 'both' | 'ipv6-only';

/**
 * Timestamping options.
 */
export type SocketTimestamping = 'off' | 'us' | 'ns';

/**
 * Options for the [Socket] section of a socket unit file.
 *
 * @see systemd.socket(5)
 */
export type SocketSectionOptions = {
  /** Stream socket (SOCK_STREAM) address (path, fdname, or host:port). */
  ListenStream?: string;

  /** Datagram socket (SOCK_DGRAM) address. */
  ListenDatagram?: string;

  /** Sequential packet socket (SOCK_SEQPACKET) address. */
  ListenSequentialPacket?: string;

  /** File system FIFO to listen on. */
  ListenFIFO?: string;

  /** Special file to listen on. */
  ListenSpecial?: string;

  /** Netlink family to listen on. */
  ListenNetlink?: string;

  /** POSIX message queue to listen on. */
  ListenMessageQueue?: string;

  /** USB FunctionFS endpoints location. */
  ListenUSBFunction?: string;

  /** Socket protocol: "udplite", "sctp", or "mptcp". */
  SocketProtocol?: SocketProtocol;

  /** IPv6 binding behavior: "default", "both", or "ipv6-only". */
  BindIPv6Only?: BindIPv6Only;

  /** Connection queue size (backlog). */
  Backlog?: number;

  /** Network interface to bind to. */
  BindToDevice?: string;

  /** UNIX user owning socket/FIFO nodes. */
  SocketUser?: string;

  /** UNIX group owning socket/FIFO nodes. */
  SocketGroup?: string;

  /** File access mode for socket/FIFO (octal, default: 0666). */
  SocketMode?: string | number;

  /** Access mode for parent directories (octal, default: 0755). */
  DirectoryMode?: string | number;

  /** Spawn per-connection service instance. */
  Accept?: 'yes' | 'no';

  /** Open special file in read-write mode. */
  Writable?: 'yes' | 'no';

  /** Clear socket buffers after service exits. */
  FlushPending?: 'yes' | 'no';

  /** Max concurrent connection service instances (default: 64). */
  MaxConnections?: number;

  /** Max connections per source IP/UID (0=disabled). */
  MaxConnectionsPerSource?: number;

  /** TCP keep-alive. */
  KeepAlive?: 'yes' | 'no';

  /** Idle time before keep-alive probes. */
  KeepAliveTimeSec?: string;

  /** Interval between keep-alive probes. */
  KeepAliveIntervalSec?: string;

  /** Unacknowledged probes before dead. */
  KeepAliveProbes?: number;

  /** Disable Nagle's algorithm. */
  NoDelay?: 'yes' | 'no';

  /** Socket priority. */
  Priority?: number;

  /** Wait for data before waking process. */
  DeferAcceptSec?: string;

  /** Receive buffer size. */
  ReceiveBuffer?: number;

  /** Send buffer size. */
  SendBuffer?: number;

  /** IP Type-of-Service. */
  IPTOS?: string | number;

  /** IPv4 TTL / IPv6 Hop-Count. */
  IPTTL?: number;

  /** Firewall mark. */
  Mark?: number;

  /** Allow multiple binds to same port (SO_REUSEPORT). */
  ReusePort?: 'yes' | 'no';

  /** Bind to non-local IP addresses. */
  FreeBind?: 'yes' | 'no';

  /** IP transparent socket option. */
  Transparent?: 'yes' | 'no';

  /** Allow broadcast datagrams. */
  Broadcast?: 'yes' | 'no';

  /** Receive sender credentials (SO_PASSCRED). */
  PassCredentials?: 'yes' | 'no';

  /** Receive sender pidfd. */
  PassPIDFD?: 'yes' | 'no';

  /** Receive sender security context. */
  PassSecurity?: 'yes' | 'no';

  /** Receive per-packet metadata. */
  PassPacketInfo?: 'yes' | 'no';

  /** Allow SCM_RIGHTS messages (default: yes). */
  AcceptFileDescriptors?: 'yes' | 'no';

  /** Timestamping mode: "off", "us", or "ns". */
  Timestamping?: SocketTimestamping;

  /** TCP congestion algorithm. */
  TCPCongestion?: string;

  /** SMACK security label. */
  SmackLabel?: string;

  /** SMACK incoming label. */
  SmackLabelIPIn?: string;

  /** SMACK outgoing label. */
  SmackLabelIPOut?: string;

  /** Derive SELinux context from network. */
  SElinuxContextFromNet?: 'yes' | 'no';

  /** Pipe buffer size for FIFOs. */
  PipeSize?: number;

  /** POSIX MQ max messages. */
  MessageQueueMaxMessages?: number;

  /** POSIX MQ message size. */
  MessageQueueMessageSize?: number;

  /** Commands before sockets are created. */
  ExecStartPre?: string;

  /** Commands after sockets are created. */
  ExecStartPost?: string;

  /** Commands before sockets are closed. */
  ExecStopPre?: string;

  /** Commands after sockets are closed. */
  ExecStopPost?: string;

  /** Timeout for ExecStart/Stop commands. */
  TimeoutSec?: string;

  /** Service unit to activate (default: same name minus .socket). */
  Service?: string;

  /** Remove file nodes on stop. */
  RemoveOnStop?: 'yes' | 'no';

  /** Symlinks to socket/FIFO path. */
  Symlinks?: string;

  /** Name for received FDs. */
  FileDescriptorName?: string;

  /** Activation rate limit interval (default: "2s"). */
  TriggerLimitIntervalSec?: string;

  /** Activations per interval (default: 200 or 20). */
  TriggerLimitBurst?: number;

  /** Polling rate limit interval (default: "2s"). */
  PollLimitIntervalSec?: string;

  /** Polling events per interval (default: 150 or 15). */
  PollLimitBurst?: number;

  /** Defer trigger: "yes", "no", or "patient". */
  DeferTrigger?: string;

  /** Max defer time for DeferTrigger. */
  DeferTriggerMaxSec?: string;

  /** Pass FDs to ExecStartPost/ExecStopPre/ExecStopPost. */
  PassFileDescriptorsToExec?: 'yes' | 'no';
};

/**
 * Complete socket unit configuration.
 */
export type SocketUnitConf = {
  Unit?: UnitSectionOptions;
  Socket: SocketSectionOptions;
  Install?: InstallSectionOptions;
};

// ---------------------------------------------------------------------------
// [Mount] section
// ---------------------------------------------------------------------------

/**
 * Options for the [Mount] section of a mount unit file.
 *
 * @see systemd.mount(5)
 */
export type MountSectionOptions = {
  /** Device/node/resource to mount (mandatory). */
  What: string;

  /** Mount point absolute path (mandatory, must match unit filename). */
  Where: string;

  /** File system type (e.g., ext4, nfs, tmpfs). */
  Type?: string;

  /** Comma-separated mount options. */
  Options?: string;

  /** Tolerate unknown mount options. */
  SloppyOptions?: 'yes' | 'no';

  /** Lazy unmount (umount -l). */
  LazyUnmount?: 'yes' | 'no';

  /** Fail immediately if RW mount fails. */
  ReadWriteOnly?: 'yes' | 'no';

  /** Force unmount (umount -f). */
  ForceUnmount?: 'yes' | 'no';

  /** Access mode for created directories (octal, default: 0755). */
  DirectoryMode?: string | number;

  /** Timeout for mount command. */
  TimeoutSec?: string;
};

/**
 * Complete mount unit configuration.
 */
export type MountUnitConf = {
  Unit?: UnitSectionOptions;
  Mount: MountSectionOptions;
  Install?: InstallSectionOptions;
};

// ---------------------------------------------------------------------------
// [Path] section
// ---------------------------------------------------------------------------

/**
 * Options for the [Path] section of a path unit file.
 *
 * @see systemd.path(5)
 */
export type PathSectionOptions = {
  /** Activate when file/directory exists. */
  PathExists?: string;

  /** Activate when any file matching glob exists. */
  PathExistsGlob?: string;

  /** Activate when file/directory changes (on close). */
  PathChanged?: string;

  /** Activate on any write to file. */
  PathModified?: string;

  /** Activate when directory contains files. */
  DirectoryNotEmpty?: string;

  /** Unit to activate (default: same name minus .path). */
  Unit?: string;

  /** Create watched directories if missing. */
  MakeDirectory?: 'yes' | 'no';

  /** Mode for created directories (octal, default: 0755). */
  DirectoryMode?: string | number;

  /** Activation rate limit interval (default: "2s"). */
  TriggerLimitIntervalSec?: string;

  /** Activations per interval (default: 200). */
  TriggerLimitBurst?: number;
};

/**
 * Complete path unit configuration.
 */
export type PathUnitConf = {
  Unit?: UnitSectionOptions;
  Path: PathSectionOptions;
  Install?: InstallSectionOptions;
};

// ---------------------------------------------------------------------------
// [Slice] section
// ---------------------------------------------------------------------------

/**
 * Options for the [Slice] section of a slice unit file.
 *
 * @see systemd.slice(5)
 * @see systemd.resource-control(5)
 */
export type SliceSectionOptions = {
  /** Hard limit on concurrent active units. */
  ConcurrencyHardMax?: number | string;

  /** Soft limit; excess activations are queued. */
  ConcurrencySoftMax?: number | string;

  /** CPU weight (1-10000, default: 100). */
  CPUWeight?: number;

  /** Memory high watermark (soft limit, e.g., "500M", "1G"). */
  MemoryHigh?: string;

  /** Memory hard limit (e.g., "1G", "50%"). */
  MemoryMax?: string;

  /** Maximum number of tasks. */
  TasksMax?: number | string;

  /** IO weight (1-10000, default: 100). */
  IOWeight?: number;

  /** CPU quota percentage (e.g., "50%" means half a CPU). */
  CPUQuota?: string;

  /** Memory limit (legacy, use MemoryMax). */
  MemoryLimit?: string;

  /** IO device weight for a specific device (device_path:weight). */
  IODeviceWeight?: string;

  /** IO read bandwidth limit for a device (device_path:bytes_per_sec). */
  IODeviceReadBandwidth?: string;

  /** IO write bandwidth limit for a device (device_path:bytes_per_sec). */
  IODeviceWriteBandwidth?: string;

  /** IO read IOPS limit for a device. */
  IODeviceReadIOPSMax?: string;

  /** IO write IOPS limit for a device. */
  IODeviceWriteIOPSMax?: string;
};

/**
 * Complete slice unit configuration.
 */
export type SliceUnitConf = {
  Unit?: UnitSectionOptions;
  Slice: SliceSectionOptions;
  Install?: InstallSectionOptions;
};

// ---------------------------------------------------------------------------
// [Automount] section
// ---------------------------------------------------------------------------

/**
 * Options for the [Automount] section of an automount unit file.
 *
 * @see systemd.automount(5)
 */
export type AutomountSectionOptions = {
  /** Automount point absolute path (mandatory, must match unit filename). */
  Where: string;

  /** Extra mount options for autofs mountpoint. */
  ExtraOptions?: string;

  /** Access mode for created directories (octal, default: 0755). */
  DirectoryMode?: string | number;

  /** Idle timeout before unmount attempt (default: disabled). */
  TimeoutIdleSec?: string;
};

/**
 * Complete automount unit configuration.
 */
export type AutomountUnitConf = {
  Unit?: UnitSectionOptions;
  Automount: AutomountSectionOptions;
  Install?: InstallSectionOptions;
};

// ---------------------------------------------------------------------------
// Device, Target, Scope units (no type-specific section or minimal)
// ---------------------------------------------------------------------------

/**
 * Device unit configuration.
 *
 * Device units are dynamically created by systemd from udev.
 * Configuration is typically done via udev properties (SYSTEMD_WANTS, etc.)
 * rather than unit files.
 *
 * @see systemd.device(5)
 */
export type DeviceUnitConf = {
  Unit?: UnitSectionOptions;
  Install?: InstallSectionOptions;
};

/**
 * Target unit configuration.
 *
 * Target units are used for grouping and synchronization.
 * They only use [Unit] and [Install] sections.
 *
 * @see systemd.target(5)
 */
export type TargetUnitConf = {
  Unit?: UnitSectionOptions;
  Install?: InstallSectionOptions;
};

/**
 * Scope unit configuration.
 *
 * Scope units are created programmatically via systemd's D-Bus API,
 * not via unit files. They have minimal configuration.
 *
 * @see systemd.scope(5)
 */
export type ScopeSectionOptions = {
  /** OOM policy: "continue", "stop", or "kill". */
  OOMPolicy?: OomPolicy;

  /** Maximum runtime (default: infinity). */
  RuntimeMaxSec?: string;

  /** Random extra runtime added to RuntimeMaxSec. */
  RuntimeRandomizedExtraSec?: string;

  /** CPU weight (1-10000, default: 100). */
  CPUWeight?: number;

  /** Memory high watermark (soft limit). */
  MemoryHigh?: string;

  /** Memory hard limit. */
  MemoryMax?: string;

  /** Maximum number of tasks. */
  TasksMax?: number | string;

  /** IO weight (1-10000, default: 100). */
  IOWeight?: number;
};

export type ScopeUnitConf = {
  Unit?: UnitSectionOptions;
  Scope: ScopeSectionOptions;
  Install?: InstallSectionOptions;
};

/**
 * Any systemd unit configuration.
 */
export type UnitConf =
  | ServiceUnitConf
  | TimerUnitConf
  | SocketUnitConf
  | MountUnitConf
  | DeviceUnitConf
  | TargetUnitConf
  | PathUnitConf
  | SliceUnitConf
  | ScopeUnitConf
  | AutomountUnitConf;
