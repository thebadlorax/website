function openPersistentPopup() {
    const popupWindow = window.open('/seeburg', 'test', 'width=300,height=200,resizable=0,scrollbars=0,status=no,toolbar=no,menubar=no');
    if (popupWindow) {
      popupWindow.focus();
    } else {
      alert('allow popups');
    }
}

openPersistentPopup();