/**
 * author thebadlorax
 * created on 25-06-2026-11h-38m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

const asciiToHex = (str) => {
    return [...str]
      .map(char => char.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');
};

const generateRandomString = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters.charAt(randomIndex);
    }
    return result;
}

banner.addEventListener("click", () => {
    window.location.href = "/"
})

const img = document.getElementById("t");

let isDragging = false;
let done = false;
let startX = 0;
let startY = 0;
let initialLeft = 0;
let initialTop = 0;
let currentX = 0; let currentY = 0;

// Start dragging
const dragStart = (e) => {
    if(localStorage.getItem("abc") || done) return;
    if(!localStorage.getItem("abcd")) {
        img.style.cursor = ""
        document.body.style.cursor = "not-allowed"
        setTimeout(() => {
            img.style.cursor = "grab"
            document.body.style.cursor = ""
        }, 500)
        return;
    }
    isDragging = true;

    img.style.cursor = ""
    document.body.style.cursor = "grabbing"
  
    // Handle both mouse and touch events
    const pageX = e.touches ? e.touches[0].pageX : e.pageX;
    const pageY = e.touches ? e.touches[0].pageY : e.pageY;
    
    startX = pageX;
    startY = pageY;
    
    initialLeft = img.offsetLeft;
    initialTop = img.offsetTop;
};

// Calculate and move image
const dragMove = (e) => {
    if (!isDragging) return;
    if(localStorage.getItem("abc")) return;
    
    currentX = e.touches ? e.touches[0].clientX : e.clientX;
    currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const pageX = e.touches ? e.touches[0].pageX : e.pageX;
    const pageY = e.touches ? e.touches[0].pageY : e.pageY;
    
    // Determine how far the pointer has traveled
    const deltaX = pageX - startX;
    const deltaY = pageY - startY;
    
    // Apply new coordinates to the image
    img.style.left = `${initialLeft + deltaX}px`;
    img.style.top = `${initialTop + deltaY}px`;
};

// Stop dragging
const dragEnd = () => {
    if(!localStorage.getItem("abcd")) return;
    isDragging = false;

    img.style.cursor = "grab"
    document.body.style.cursor = ""
    if(localStorage.getItem("abc") || done) return;

    img.style.pointerEvents = 'none';
    
    const elementUnderCursor = document.elementFromPoint(currentX, currentY);
    
    img.style.pointerEvents = 'auto';

    if (elementUnderCursor.id == "mnp") {
        img.remove();
        done = true;
        alert(asciiToHex(generateRandomString(Math.floor(Math.random()*15)) + " /stage1 " + generateRandomString(Math.floor(Math.random()*15))))
        //localStorage.setItem("abc", true)
    }
};

img.addEventListener("mousedown", dragStart);
document.addEventListener("mousemove", dragMove);
document.addEventListener("mouseup", dragEnd);