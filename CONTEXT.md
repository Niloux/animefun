# Animefun Context

Animefun tracks anime viewing and download activity across Bangumi, Mikan, and a local desktop runtime. This context names the domain concepts used by the app so modules can be discussed without leaking implementation details.

## Language

**New episode notification delivery**:
A desktop alert for a newly published episode. Animefun uses at-least-once delivery: it advances the observed episode only after the notification adapter accepts the notification. If delivery succeeds but persistence fails, the next cycle may repeat the alert.
_Avoid_: Exactly-once notification

**Tracked download**:
A user's tracked intent to download one Bangumi subject, optionally tied to an episode or episode range. A Tracked download may be matched with external download state, but it is not the external torrent itself.
_Avoid_: Download task, Download item, torrent

**Tracked download addition**:
The creation of a Tracked download only when the user's download has also been accepted by the external downloader. There is no pending Tracked download after a failed addition.
_Avoid_: Pending download, retry intent

**Download status projection**:
A view of a Tracked download combined with external download state. The Tracked download is the source of identity and anime ownership; the external downloader is the source of runtime status such as progress, speed, and save location.
_Avoid_: Download item

**Live download state**:
A Download status projection where the External downloader currently reports runtime state for the Tracked download.
_Avoid_: Tracked download

**Stale download state**:
A Download status projection where the Tracked download still exists but current external download state is unavailable. Stale download state is not the same as a stopped external download.
_Avoid_: stopped, paused

**Missing download state**:
A Download status projection where the External downloader is available but no longer reports the Tracked download. Missing download state is different from Stale download state because the external state source was reachable.
_Avoid_: stopped, stale

**Download display metadata**:
The title and cover used to identify a Tracked download in a Download status projection. It may come from saved download metadata, a local anime index, or Bangumi, but it is not the full Bangumi subject.
_Avoid_: Subject data, Bangumi response

**External downloader**:
The outside system that accepts a Tracked download addition and reports runtime download state. Animefun treats it as an external state source, not as the identity of the Tracked download.
_Avoid_: Tracked download, torrent

**Download location**:
The filesystem location reported for a Tracked download by the External downloader. It is used to locate downloaded content, but opening it is a desktop runtime action.
_Avoid_: save path

**Playable download file**:
The file within a Download location that Animefun considers suitable for playback. It is chosen from external download file state, not from the Tracked download identity alone.
_Avoid_: torrent file

## Example Dialogue

Developer: "Should the Download lifecycle be centered on the qBittorrent torrent?"
Domain expert: "No. The user is tracking a Bangumi subject episode. The torrent is only one external state source for that Tracked download."

Developer: "If the external downloader rejects the torrent, do we keep a Tracked download for retry?"
Domain expert: "No. The Tracked download addition did not happen."

Developer: "If qBittorrent is unavailable, is the Tracked download stopped?"
Domain expert: "No. The Tracked download still exists, but its Download status projection has stale download state."

Developer: "If the External downloader is reachable but no longer has the download, is that stale?"
Domain expert: "No. That is Missing download state."

Developer: "When the External downloader reports progress and speed, what state is that?"
Domain expert: "That is Live download state."

Developer: "Does the Download lifecycle own Bangumi subject fetching?"
Domain expert: "No. It owns Download display metadata for Tracked downloads, not full Bangumi subject data."

Developer: "Is the external torrent the Tracked download?"
Domain expert: "No. The External downloader reports runtime state for the Tracked download."

Developer: "Does the Download lifecycle open video files?"
Domain expert: "No. It identifies the Playable download file; the desktop runtime opens it."
