package com.expensify.chat.customairshipextender;

import android.content.Context;
import androidx.annotation.NonNull;
import com.urbanairship.UAirship;
import com.urbanairship.push.NotificationActionButtonInfo;
import com.urbanairship.push.NotificationListener;
import com.urbanairship.push.PushMessage;
import com.urbanairship.push.PushManager;
import com.urbanairship.push.NotificationInfo;
import com.urbanairship.reactnative.AirshipExtender;

import java.util.PriorityQueue;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import android.app.Notification;
import android.app.NotificationManager;

public class CustomAirshipExtender implements AirshipExtender {
    private PriorityQueue<String> notificationQueue;
    private ScheduledExecutorService scheduler;
    private static final long DELAY_MILLISECONDS = 5000; // 5 seconds delay
    private CustomNotificationProvider notificationProvider;
    private Context context;
    @Override
    public void onAirshipReady(@NonNull Context context, @NonNull UAirship airship) {
        PushManager pushManager = airship.getPushManager();
        this.context = context;
        notificationProvider = new CustomNotificationProvider(context, airship.getAirshipConfigOptions());
        pushManager.setNotificationProvider(notificationProvider);

        // Initialize the notification queue and scheduler
        this.notificationQueue = new PriorityQueue<>((n1, n2) -> Long.compare(n1.getSentTime(), n2.getSentTime()));
        scheduler = Executors.newSingleThreadScheduledExecutor();

        // Set up a custom notification listener
        pushManager.setNotificationListener(new NotificationListener() {
            @Override
            public void onNotificationPosted(@NonNull NotificationInfo notificationInfo) {
                // Add the notification to the queue
                String sendId = notificationInfo.getMessage().getSendId();
                notificationQueue.offer(sendId);

                // Schedule processing of the queue
                scheduleQueueProcessing();
            }

            @Override
            public boolean onNotificationOpened(@NonNull NotificationInfo notificationInfo) {
                return false;
            }

            @Override
            public boolean onNotificationForegroundAction(@NonNull NotificationInfo notificationInfo, @NonNull NotificationActionButtonInfo actionButtonInfo) {
                return false;
            }

            @Override
            public void onNotificationBackgroundAction(@NonNull NotificationInfo notificationInfo, @NonNull NotificationActionButtonInfo actionButtonInfo) {

            }

            @Override
            public void onNotificationDismissed(@NonNull NotificationInfo notificationInfo) {
                
            }
        });
    }

    private void scheduleQueueProcessing() {
        scheduler.schedule(this::processNotificationQueue, DELAY_MILLISECONDS, TimeUnit.MILLISECONDS);
    }

    private void processNotificationQueue() {
        while (!notificationQueue.isEmpty()) {
            String sendId = notificationQueue.poll();
            if (sendId != null) {
                // Retrieve the notification from the provider
                Notification notification = this.notificationProvider.getNotification(sendId);

                if (notification != null) {
                    // Post the notification using NotificationManager
                    NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

                    // Use the notification ID from the NotificationInfo if available
                    int notificationId = generateNotificationId(sendId);

                    notificationManager.notify(notificationId, notification);
                }
            }
        }
    }

    // Generate a unique notification ID based on the send ID
    private int generateNotificationId(String sendId) {
        return sendId.hashCode();
    }
}
