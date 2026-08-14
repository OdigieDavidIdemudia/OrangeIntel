document.addEventListener('DOMContentLoaded', () => {
    // --- Scroll Animations ---
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    animatedElements.forEach(el => observer.observe(el));


    // --- Theme Toggle ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const iconSun = document.querySelector('.icon-sun');
    const iconMoon = document.querySelector('.icon-moon');
    
    // Check saved preference or system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Function to apply theme
    const applyTheme = (isDark) => {
        if (isDark) {
            document.documentElement.classList.add('theme-dark');
            document.documentElement.classList.remove('theme-light');
            iconSun.style.display = 'none';
            iconMoon.style.display = 'block';
        } else {
            document.documentElement.classList.add('theme-light');
            document.documentElement.classList.remove('theme-dark');
            iconSun.style.display = 'block';
            iconMoon.style.display = 'none';
        }
    };

    // Initialize theme
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        applyTheme(true);
    } else {
        applyTheme(false);
    }

    // Toggle event listener
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = document.documentElement.classList.contains('theme-dark');
            applyTheme(!isDark);
            localStorage.setItem('theme', !isDark ? 'dark' : 'light');
        });
    }

    // --- Compliance Banner ---
    const complianceBanner = document.getElementById('compliance-banner');
    const btnAccept = document.getElementById('btn-accept');
    const btnDecline = document.getElementById('btn-decline');

    if (complianceBanner && !localStorage.getItem('compliance-agreed')) {
        // Show after a short delay
        setTimeout(() => {
            complianceBanner.classList.add('is-active');
        }, 1000);
    }

    const dismissBanner = () => {
        if (complianceBanner) {
            complianceBanner.classList.remove('is-active');
            localStorage.setItem('compliance-agreed', 'true');
        }
    };

    if (btnAccept) btnAccept.addEventListener('click', dismissBanner);
    if (btnDecline) btnDecline.addEventListener('click', dismissBanner);

    // --- Three.js Generic Scene Helper ---
    const createStylizedScene = (containerId, buildObjectsFn) => {
        const container = document.getElementById(containerId);
        if (!container || typeof THREE === 'undefined') return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(0, 0, 10);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        const objects = buildObjectsFn(scene);

        window.addEventListener('resize', () => {
            if (container.clientWidth > 0) {
                camera.aspect = container.clientWidth / container.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.clientWidth, container.clientHeight);
            }
        });

        let mouseX = 0, mouseY = 0;
        const windowHalfX = window.innerWidth / 2;
        const windowHalfY = window.innerHeight / 2;
        document.addEventListener('mousemove', (event) => {
            mouseX = (event.clientX - windowHalfX);
            mouseY = (event.clientY - windowHalfY);
        });

        const clock = new THREE.Clock();
        const animate = () => {
            requestAnimationFrame(animate);
            const elapsedTime = clock.getElapsedTime();
            
            const targetX = mouseX * 0.0015;
            const targetY = mouseY * 0.0015;

            // Custom object animation
            if (objects && objects.animate) {
                objects.animate(elapsedTime, targetX, targetY);
            }

            renderer.render(scene, camera);
        };
        animate();
    };

    // Helper for stylized materials
    const getStylizedMaterial = (colorCode) => {
        return new THREE.MeshBasicMaterial({ color: colorCode });
    };
    const getLineMaterial = () => {
        return new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    };

    // 1. Hero Scene (3 Human Analysts)
    createStylizedScene('three-canvas-container', (scene) => {
        scene.position.y = -1;
        const createHuman = (color, xPos) => {
            const group = new THREE.Group();
            const mat = getStylizedMaterial(color);
            const lineMat = getLineMaterial();

            const headGeo = new THREE.SphereGeometry(0.6, 16, 16);
            const head = new THREE.Mesh(headGeo, mat);
            head.add(new THREE.LineSegments(new THREE.EdgesGeometry(headGeo), lineMat));
            head.position.y = 2.4;
            group.add(head);

            const bodyGeo = new THREE.CylinderGeometry(0.8, 0.5, 2.2, 16);
            const body = new THREE.Mesh(bodyGeo, mat);
            body.add(new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo), lineMat));
            body.position.y = 0.8;
            group.add(body);

            group.position.x = xPos;
            scene.add(group);
            return group;
        };
        const analysts = [
            createHuman(0xF1F1F1, -2.5),
            createHuman(0x0D9488, 0),
            createHuman(0xD1D1D1, 2.5)
        ];
        return {
            animate: (time, tx, ty) => {
                analysts.forEach((a, i) => {
                    a.position.y = Math.sin(time * 2 + i) * 0.15;
                    a.rotation.y += 0.05 * (tx - a.rotation.y);
                    a.rotation.x += 0.05 * (ty - a.rotation.x);
                });
            }
        };
    });

    // 2. Stats Scene (Abstract Malicious IPs/Nodes)
    createStylizedScene('three-stats-container', (scene) => {
        const nodes = [];
        const mat = getStylizedMaterial(0xef4444); // Red nodes for malicious
        const lineMat = getLineMaterial();

        for (let i = 0; i < 5; i++) {
            const size = 0.5 + Math.random() * 0.5;
            const geo = new THREE.BoxGeometry(size, size, size);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat));
            
            mesh.position.set(
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 4
            );
            scene.add(mesh);
            nodes.push({ mesh, speed: 0.5 + Math.random() });
        }
        return {
            animate: (time, tx, ty) => {
                scene.rotation.y += 0.05 * (tx - scene.rotation.y);
                scene.rotation.x += 0.05 * (ty - scene.rotation.x);
                nodes.forEach((n, i) => {
                    n.mesh.rotation.x += 0.01 * n.speed;
                    n.mesh.rotation.y += 0.01 * n.speed;
                    n.mesh.position.y += Math.sin(time * 2 + i) * 0.01;
                });
            }
        };
    });

    // 3. Pipeline Scene (Raw Data to Information)
    createStylizedScene('three-pipeline-container', (scene) => {
        const group = new THREE.Group();
        scene.add(group);

        // Information Cube (Center)
        const centerGeo = new THREE.BoxGeometry(2, 2, 2);
        const centerMat = getStylizedMaterial(0x0D9488); // Teal
        const centerCube = new THREE.Mesh(centerGeo, centerMat);
        centerCube.add(new THREE.LineSegments(new THREE.EdgesGeometry(centerGeo), getLineMaterial()));
        group.add(centerCube);

        // Raw Data Particles floating towards center
        const particles = [];
        const rawMat = getStylizedMaterial(0xA8A8A8); // Gray

        for (let i = 0; i < 10; i++) {
            const geo = new THREE.SphereGeometry(0.2, 8, 8);
            const p = new THREE.Mesh(geo, rawMat);
            p.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), getLineMaterial()));
            
            // Random start position outside
            const angle = Math.random() * Math.PI * 2;
            const radius = 4 + Math.random() * 2;
            p.position.set(Math.cos(angle) * radius, (Math.random() - 0.5) * 4, Math.sin(angle) * radius);
            group.add(p);
            particles.push({ mesh: p, start: p.position.clone() });
        }

        return {
            animate: (time, tx, ty) => {
                group.rotation.y += 0.05 * (tx - group.rotation.y);
                centerCube.rotation.x += 0.01;
                centerCube.rotation.y += 0.01;
                
                // Animate particles towards center
                particles.forEach((p, i) => {
                    const progress = (time * 0.5 + (i * 0.1)) % 1; // 0 to 1
                    p.mesh.position.lerpVectors(p.start, new THREE.Vector3(0,0,0), progress);
                    p.mesh.scale.setScalar(1 - progress); // Shrink as it gets closer
                });
            }
        };
    });

    // 4. Specs Scene (Shield & Bot)
    createStylizedScene('three-specs-container', (scene) => {
        const group = new THREE.Group();
        scene.add(group);

        // Shield Shape
        const shape = new THREE.Shape();
        shape.moveTo(0, 1.5);
        shape.lineTo(1.5, 1.5);
        shape.lineTo(1.5, 0);
        shape.bezierCurveTo(1.5, -1.5, 0, -2, 0, -2.5);
        shape.bezierCurveTo(0, -2, -1.5, -1.5, -1.5, 0);
        shape.lineTo(-1.5, 1.5);
        shape.lineTo(0, 1.5);

        const extrudeSettings = { depth: 0.5, bevelEnabled: false };
        const shieldGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        shieldGeo.center();
        const shieldMat = getStylizedMaterial(0x0D9488); // Teal
        const shield = new THREE.Mesh(shieldGeo, shieldMat);
        shield.add(new THREE.LineSegments(new THREE.EdgesGeometry(shieldGeo), getLineMaterial()));
        shield.position.x = -1.5;
        group.add(shield);

        // Bot (Cube head, antenna)
        const botGroup = new THREE.Group();
        botGroup.position.x = 1.5;
        
        const headGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const headMat = getStylizedMaterial(0xE4E4E4); // Light Gray
        const head = new THREE.Mesh(headGeo, headMat);
        head.add(new THREE.LineSegments(new THREE.EdgesGeometry(headGeo), getLineMaterial()));
        botGroup.add(head);

        const antGeo = new THREE.CylinderGeometry(0.1, 0.1, 1);
        const ant = new THREE.Mesh(antGeo, headMat);
        ant.add(new THREE.LineSegments(new THREE.EdgesGeometry(antGeo), getLineMaterial()));
        ant.position.y = 1.25;
        botGroup.add(ant);

        const bulbGeo = new THREE.SphereGeometry(0.2);
        const bulb = new THREE.Mesh(bulbGeo, getStylizedMaterial(0xef4444)); // Red bulb
        bulb.add(new THREE.LineSegments(new THREE.EdgesGeometry(bulbGeo), getLineMaterial()));
        bulb.position.y = 1.85;
        botGroup.add(bulb);

        group.add(botGroup);

        return {
            animate: (time, tx, ty) => {
                group.rotation.y += 0.05 * (tx - group.rotation.y);
                group.rotation.x += 0.05 * (ty - group.rotation.x);
                shield.position.y = Math.sin(time * 2) * 0.2;
                botGroup.position.y = Math.sin(time * 2 + Math.PI) * 0.2;
            }
        };
    });

});
