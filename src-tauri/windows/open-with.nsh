; Puts Penwork in the "Open with" menu for .html files without taking them over: the browser
; stays the default. A normal file association would change what double-clicking an .html does.

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\Penwork.HtmlDeck" "" "HTML slide deck"
  WriteRegStr SHCTX "Software\Classes\Penwork.HtmlDeck\DefaultIcon" "" "$INSTDIR\penwork.exe,0"
  WriteRegStr SHCTX "Software\Classes\Penwork.HtmlDeck\shell\open\command" "" '"$INSTDIR\penwork.exe" "%1"'
  WriteRegStr SHCTX "Software\Classes\.html\OpenWithProgids" "Penwork.HtmlDeck" ""
  WriteRegStr SHCTX "Software\Classes\.htm\OpenWithProgids" "Penwork.HtmlDeck" ""
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegValue SHCTX "Software\Classes\.html\OpenWithProgids" "Penwork.HtmlDeck"
  DeleteRegValue SHCTX "Software\Classes\.htm\OpenWithProgids" "Penwork.HtmlDeck"
  DeleteRegKey SHCTX "Software\Classes\Penwork.HtmlDeck"
!macroend
