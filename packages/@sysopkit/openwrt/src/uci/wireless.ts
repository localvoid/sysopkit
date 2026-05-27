export type UciWireless = UciWirelessSection[];

export type UciWirelessSection = UciWifiDevice | UciWifiIface;

export type UciWifiDevice = {
  type: 'wifi-device';
  name?: string;

  options: {
    /** Radio type: mac80211, ath9k, ath10k, etc. */
    type?: string;
    /** Channel number or auto. */
    channel?: string | number;
    /** Band: 2g, 5g, 6g. */
    band?: string;
    /** HT mode: HT20, HT40, VHT20, VHT40, VHT80, VHT160, HE20, HE40, HE80, HE160. */
    htmode?: string;
    /** Country code (e.g. US, DE). */
    country?: string;
    /** Transmit power (dBm). */
    txpower?: string | number;
    /** Disable/enable radio. */
    disabled?: '0' | '1';
    /** Path to the device (PCI/USB path). */
    path?: string;
    /** MAC address. */
    macaddr?: string;
    /** Cell density: 0, 1, 2, 3. */
    cell_density?: string | number;
    /** Regulatory domain. */
    regdomain?: string;
  };
};

export type UciWifiIface = {
  type: 'wifi-iface';
  name?: string;

  options: {
    /** Associated wifi-device name. */
    device?: string;
    /** Interface name. */
    ifname?: string;
    /** Mode: ap, sta, adhoc, monitor, mesh, wds. */
    mode?: string;
    /** SSID. */
    ssid?: string;
    /** BSSID. */
    bssid?: string;
    /** Network (logical interface name from /etc/config/network). */
    network?: string;
    /** Encryption: none, wep, psk, psk2, sae, wpa, wpa2, wpa3, wpa3-mixed. */
    encryption?: string;
    /** Pre-shared key / password. */
    key?: string;
    /** WPA group cipher. */
    cipher?: string;
    /** 802.11w management frame protection: 0, 1, 2. */
    ieee80211w?: '0' | '1' | '2';
    /** WPS push button. */
    wps_pushbutton?: '0' | '1';
    /** Hide SSID. */
    hidden?: '0' | '1';
    /** Isolate clients. */
    isolate?: '0' | '1';
    /** MAC address filter: 0=disabled, 1=allow, 2=deny. */
    macfilter?: '0' | '1' | '2';
    /** Disable/enable interface. */
    disabled?: '0' | '1';
    /** WMM (Wi-Fi Multimedia). */
    wmm?: '0' | '1';
    /** Multicast to unicast conversion. */
    multicast_to_unicast?: '0' | '1';
    /** VLAN ID. */
    vlan_id?: string | number;
    /** MAC address override. */
    macaddr?: string;
    /** MFP (Management Frame Protection). */
    mfp?: '0' | '1' | '2';
  };
  lists?: {
    /** MAC addresses for allow/deny list (based on macfilter). */
    maclist?: string[];
  };
};
