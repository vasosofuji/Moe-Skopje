// Builds the editable Premiere project from out/premiere-plan.json (node scripts/premiere-plan.mjs).
// Run inside Premiere: $.evalFile(".../ad/scripts/premiere-build.jsx"). Never renders or exports.
// Tracks: V1 footage, V2 app UI shots + end frame, V3 overlays (H1 screen, white dips), V4 captions;
// A1 music, A2 SFX, A3 SFX that overlap one already on A2 (overwriteClip would cut it).
(function () {
  var report = [];
  var planFile = new File(new File($.fileName).parent.parent.fsName + "/out/premiere-plan.json");
  planFile.open("r"); var plan = JSON.parse(planFile.read()); planFile.close();

  var projFile = new File(plan.project);
  new Folder(projFile.parent.fsName).create();
  if (projFile.exists) return "project already exists: " + plan.project + " (open it instead of rebuilding)";
  if (!app.newProject(projFile.fsName)) return "newProject failed";
  var proj = app.project;
  report.push("project " + proj.path);

  var root = proj.rootItem;
  var bins = {};
  var names = ["Footage", "App UI", "Overlays", "Captions", "Audio", "Sequence"];
  for (var b = 0; b < names.length; b++) bins[names[b]] = root.createBin(names[b]);

  // Import each file once, then look items up by media path.
  var byPath = {};
  function norm(p) { return String(p).replace(/\\/g, "/").toLowerCase(); }
  function importAll(files, bin) {
    var todo = [];
    for (var i = 0; i < files.length; i++) if (!byPath[norm(files[i])] && todo.join("|").indexOf(files[i]) < 0) todo.push(new File(files[i]).fsName);
    if (todo.length) proj.importFiles(todo, true, bin, false);
    for (var j = 0; j < bin.children.numItems; j++) byPath[norm(bin.children[j].getMediaPath())] = bin.children[j];
  }
  function files(list, key) { var out = []; for (var i = 0; i < list.length; i++) out.push(list[i][key || "file"]); return out; }
  importAll(files(plan.footage), bins["Footage"]);
  importAll(files(plan.ui), bins["App UI"]);
  importAll(files(plan.overlays), bins["Overlays"]);
  importAll(files(plan.captions), bins["Captions"]);
  importAll([plan.music.file].concat(files(plan.sfx)), bins["Audio"]);
  function item(p) { var it = byPath[norm(p)]; if (!it) throw new Error("not imported: " + p); return it; }

  // Sequence from a 1920×1080 24 fps layer, then empty it.
  var seq = proj.createNewSequenceFromClips("Moe Skopje Ad", [item(plan.ui[0].file)], bins["Sequence"]);
  for (var t = 0; t < seq.videoTracks.numTracks; t++) while (seq.videoTracks[t].clips.numItems) seq.videoTracks[t].clips[0].remove(false, false);
  app.enableQE();
  var qs = qe.project.getActiveSequence();
  if (seq.videoTracks.numTracks < 4) qs.addTracks(4 - seq.videoTracks.numTracks, seq.videoTracks.numTracks, 0);
  if (seq.audioTracks.numTracks < 3) qs.addTracks(0, 0, 3 - seq.audioTracks.numTracks);
  report.push("tracks V" + seq.videoTracks.numTracks + " A" + seq.audioTracks.numTracks);

  function place(trackColl, idx, projectItem, start, srcIn, srcDur) {
    if (srcIn !== undefined) { projectItem.setInPoint(srcIn, 4); projectItem.setOutPoint(srcIn + srcDur, 4); }
    trackColl[idx].overwriteClip(projectItem, start);
    if (srcIn !== undefined) { projectItem.clearInPoint(4); projectItem.clearOutPoint(4); }
    var clips = trackColl[idx].clips;
    for (var k = clips.numItems - 1; k >= 0; k--) if (Math.abs(clips[k].start.seconds - start) < 0.02) return clips[k];
    return null;
  }
  function prop(trackItem, compName, propName) {
    for (var c = 0; c < trackItem.components.numItems; c++) {
      var comp = trackItem.components[c];
      if (comp.displayName === compName)
        for (var p = 0; p < comp.properties.numItems; p++) if (comp.properties[p].displayName === propName) return comp.properties[p];
    }
    return null;
  }
  var level = function (db) { return Math.pow(10, (db - 15) / 20); };

  // V1 footage: Kling clips are 1928×1076, so 100.4% fills the frame; every shot but H1 pushes in 5%.
  var V = seq.videoTracks, A = seq.audioTracks;
  for (var f = 0; f < plan.footage.length; f++) {
    var sh = plan.footage[f];
    var ti = place(V, 0, item(sh.file), sh.start, sh.srcIn, sh.srcDur);
    if (!ti) { report.push("MISSING " + sh.id); continue; }
    var sc = prop(ti, "Motion", "Scale");
    if (sh.id === "H1") sc.setValue(100.4, true);
    else {
      sc.setTimeVarying(true);
      var a = ti.inPoint.seconds, z = ti.outPoint.seconds;
      sc.addKey(a); sc.setValueAtKey(a, 100.4, true);
      sc.addKey(z); sc.setValueAtKey(z, 105.4, true);
    }
  }
  // Slow H1 to its edit speed (QE). setSpeed keeps the clip length, so then extend its end to the slot.
  var qv = qs.getVideoTrackAt(0);
  for (var q = 0; q < qv.numItems; q++) {
    var qi = qv.getItemAt(q);
    for (var r = 0; r < plan.footage.length; r++) {
      var fr = plan.footage[r];
      if (fr.rate === 1 || qi.type === "Empty" || Math.abs(qi.start.secs - fr.start) > 0.02) continue;
      qi.setSpeed(fr.rate, "", false, false, false);
      for (var v1 = 0; v1 < V[0].clips.numItems; v1++)
        if (Math.abs(V[0].clips[v1].start.seconds - fr.start) < 0.02) { var te = new Time(); te.seconds = fr.start + fr.dur; V[0].clips[v1].end = te; }
    }
  }

  for (var u = 0; u < plan.ui.length; u++) place(V, 1, item(plan.ui[u].file), plan.ui[u].start);
  for (var o = 0; o < plan.overlays.length; o++) place(V, 2, item(plan.overlays[o].file), plan.overlays[o].start);
  for (var cpt = 0; cpt < plan.captions.length; cpt++) place(V, 3, item(plan.captions[cpt].file), plan.captions[cpt].start);

  // A1 music from the edit's song offset to the end, with the edit's volume curve.
  var m = place(A, 0, item(plan.music.file), 0, plan.music.srcIn, plan.total);
  if (m) {
    var lv = prop(m, "Volume", "Level");
    lv.setTimeVarying(true);
    for (var k2 = 0; k2 < plan.musicKeys.length; k2++) {
      var tk = m.inPoint.seconds + plan.musicKeys[k2][0];
      lv.addKey(tk); lv.setValueAtKey(tk, level(plan.musicKeys[k2][1]), true);
    }
  }
  // A2 synthesised SFX; a cue that starts before the previous A2 cue ends goes to A3.
  var busy = 0;
  for (var x = 0; x < plan.sfx.length; x++) {
    var pi = item(plan.sfx[x].file), dur = pi.getOutPoint(4).seconds - pi.getInPoint(4).seconds;
    var tr = plan.sfx[x].at >= busy - 0.001 ? 1 : 2;
    if (tr === 1) busy = plan.sfx[x].at + dur;
    var s = place(A, tr, pi, plan.sfx[x].at);
    if (s) prop(s, "Volume", "Level").setValue(level(plan.sfx[x].db), true);
  }

  for (var mk = 0; mk < plan.markers.length; mk++) seq.markers.createMarker(plan.markers[mk].t).name = plan.markers[mk].name;
  seq.setOutPoint(plan.total);
  proj.save();
  report.push("V1 " + V[0].clips.numItems + " / V2 " + V[1].clips.numItems + " / V3 " + V[2].clips.numItems + " / V4 " + V[3].clips.numItems +
    " / A1 " + A[0].clips.numItems + " / A2 " + A[1].clips.numItems + " / A3 " + A[2].clips.numItems + ", seq end " + seq.end);
  return report.join("\n");
})();
