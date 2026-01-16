function openPersistentPopup() {
    const popupWindow = window.open('/seeburg', 'test', 'width=300,height=200,resizable=0,scrollbars=0,status=no,toolbar=no,menubar=no');
    if (popupWindow) {
      popupWindow.focus();
    } else {
      alert('Please allow popups for this site to use this feature.');
    }
}

openPersistentPopup();