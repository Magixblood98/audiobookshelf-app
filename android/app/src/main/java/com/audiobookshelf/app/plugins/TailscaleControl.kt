package com.audiobookshelf.app.plugins

import android.content.Intent
import android.content.pm.PackageManager
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress

/**
 * Turns the Tailscale app's VPN on or off, using the broadcasts Tailscale accepts from other apps
 * (the same ones Tasker uses), and reports whether it's connected.
 */
@CapacitorPlugin(name = "TailscaleControl")
class TailscaleControl : Plugin() {
  private val tag = "TailscaleControl"

  companion object {
    const val TAILSCALE_PACKAGE = "com.tailscale.ipn"
    const val RECEIVER = "com.tailscale.ipn.IPNReceiver"
  }

  @PluginMethod
  fun status(call: PluginCall) {
    val ret = JSObject()
    ret.put("installed", isInstalled())
    ret.put("connected", isConnected())
    call.resolve(ret)
  }

  @PluginMethod
  fun connect(call: PluginCall) {
    send(call, "com.tailscale.ipn.CONNECT_VPN")
  }

  @PluginMethod
  fun disconnect(call: PluginCall) {
    send(call, "com.tailscale.ipn.DISCONNECT_VPN")
  }

  private fun send(call: PluginCall, action: String) {
    if (!isInstalled()) {
      call.reject("Tailscale isn't installed")
      return
    }
    try {
      val intent = Intent(action).apply { setClassName(TAILSCALE_PACKAGE, RECEIVER) }
      context.sendBroadcast(intent)
      call.resolve()
    } catch (e: Exception) {
      Log.e(tag, "Failed to send $action", e)
      call.reject("Couldn't reach the Tailscale app (${e.message})")
    }
  }

  private fun isInstalled(): Boolean {
    return try {
      context.packageManager.getPackageInfo(TAILSCALE_PACKAGE, 0)
      true
    } catch (e: PackageManager.NameNotFoundException) {
      false
    }
  }

  /**
   * Connected when this app's traffic to the Tailscale range would leave from a Tailscale address (100.64.0.0/10).
   * A UDP "connect" sends nothing; it only asks the system which route and source address it would use.
   */
  private fun isConnected(): Boolean {
    var socket: DatagramSocket? = null
    return try {
      socket = DatagramSocket()
      socket.connect(InetAddress.getByName("100.100.100.100"), 53)
      val local = socket.localAddress
      local is Inet4Address && isTailscaleAddress(local)
    } catch (e: Exception) {
      false
    } finally {
      socket?.close()
    }
  }

  private fun isTailscaleAddress(address: InetAddress): Boolean {
    val b = address.address
    return b.size == 4 && (b[0].toInt() and 0xff) == 100 && (b[1].toInt() and 0xc0) == 64
  }
}
