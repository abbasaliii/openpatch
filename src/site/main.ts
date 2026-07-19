const observe = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("revealed");
  });
}, { threshold: 0.12 });

document.querySelectorAll(".section, .proof-bar, .impact-band").forEach((element) => observe.observe(element));
