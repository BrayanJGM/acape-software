// JavaScript
window.addEventListener('load', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/services/sw.js')
            .then(registration => {
                console.log('Service Worker registrado con éxito:', registration);

                Notification.requestPermission()
                .then(permission => {
                    if (permission === 'granted') {
                        return registration;
                    } else {
                        throw new Error('Permiso para notificaciones denegado.');
                    }
                })
                .then(serviceWorkerRegistration => {
                    return {serviceWorkerRegistration, data: serviceWorkerRegistration.pushManager.getSubscription()};
                }).then(async (existingSubscription) => {
                    let resigtring = await existingSubscription.data;
                    if (resigtring) {
                        // La suscripción ya existe, evita volver a suscribirse
                        throw new Error('Servicio ya suscrito');
                    }

                    // Si no existe, procede a suscribirse
                    const subscribeOptions = {
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array('BIToSRYudj90k40hFJFcDAlS9P4xZfCNpZoj9iR34xYE3iC6iO1bFsjTxhi5YzJR93JSrcRnHhmWDJ56gGjvaZ8')
                    };
                    return existingSubscription.serviceWorkerRegistration.pushManager.subscribe(subscribeOptions);
                })
                .then(pushSubscription => {
                    console.log('Suscripción a notificaciones push:', JSON.stringify(pushSubscription));

                    // Almacenar la suscripción en sessionStorage para evitar múltiples suscripciones
                    sessionStorage.setItem('pushSubscription', JSON.stringify(pushSubscription));

                    return socket.emit('notify/subscribe', pushSubscription);
                })
                .then(response => console.log(response))
                .then(data => console.log('Respuesta del servidor:', data))
                .catch(error => console.error('Error al suscribirse a las notificaciones:', error));
            })
            .catch(error => console.error('Error al registrar el Service Worker:', error));
    }
});

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
}
