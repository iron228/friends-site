const friendsData = {
    1: {
        name: "Kirillfdt",
        text: "С данным человеком я познакомился года 2 назад. И для меня он действительно важен тем, что он не перебарщивает в шутках. Понимает мой юмор, да и вообще чиловый парень. Спасибо что ты есть."

    },
    2: {
        name: "Xonik",
        text: "С данный человеком мы знакомы недолгое время. Но я все таки могу назвать его одним из важных мне людей. Именно он мне подсказывал вещи, которые я не знал. Именно благодаря ему я вероятно пишу код, так как я верю в себя. Спасибо, что ты есть."
    },
    3: {
        name: "Sueka",
        text: "Ситуация такая же, я не знаком с ней долгое время. Но за все время сколько я с ней общаюсь в чате, она действительно стала для меня родной. Спасибо, что ты есть."
    },
    4: {
        name: "Chillman",
        text: "Такая же ситуация, как и с прошлой, Человек дейсвительно комфортный в плане общения для меня. Всегда найдет как пошутить, всегда поддержит (вроде). Спасибо, что ты есть."
    }
};
const buttons = document.querySelectorAll('.btn-details');
buttons.forEach(function(button) {
    button.addEventListener('click', function() {
        const card = button.closest('.friend-card');
        const id = card.dataset.id;
        const details = card.querySelector('.details');
        if (details.innerHTML === '') {
            details.innerHTML = '<p>' + friendsData[id].text + '</p>';
            button.textContent = 'Скрыть';
        } else {
            details.innerHTML = '';
            button.textContent = 'Узнать подробнее...'; 
        }
    });
});