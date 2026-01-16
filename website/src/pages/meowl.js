const explosion = document.createElement("img")
explosion.src = "explosion.gif"
explosion.style.position = "absolute"
explosion.style.display = "none";
explosion.style.zIndex = 9999;
explosion.style.width = "200%"
explosion.style.height = "auto";
explosion.style.opacity = "1";

const unmute_button = document.getElementById("unmute")
unmute_button.addEventListener("click", () => {
    let sound = new Audio("new_soul.mp3");
    sound.loop = true;
    sound.volume = 0.2
    sound.play();
    unmute_button.remove();
})

document.addEventListener("click", (event) => {
    let new_explosion = explosion.cloneNode();
    var imageUrl = new_explosion.src;
    var cleanUrl = imageUrl.split('?')[0];
    var newSrc = cleanUrl + '?' + (new Date().getTime());
    new_explosion.src = newSrc;
    new_explosion.style.transform = `translate(${event.clientX - window.innerWidth}px, ${event.clientY - window.innerHeight}px)`;
    document.body.appendChild(new_explosion);

    var audio = new Audio("explosion.mp3");
    audio.volume = 0.2
    audio.play();

    setTimeout(() => {
        new_explosion.style.display = "block";
    }, 100);
    setTimeout(() => {
        new_explosion.remove();
    }, 900);
})

const new_soul_song = new Audio("new_soul.mp3")
audio.play();